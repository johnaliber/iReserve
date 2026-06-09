'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import DashboardShell from '@/components/layout/DashboardShell';
import { 
  AlertTriangle,
  BellRing,
  Building2,
  CalendarClock,
  CreditCard, 
  Check, 
  X, 
  Coins, 
  ShieldCheck, 
  Filter, 
  Download,
  FileCheck,
  Loader2,
} from 'lucide-react';
import PaymentVerificationPanel from '@/components/accounting/PaymentVerificationPanel';
import { formatPeso } from '@/lib/payments/paymentMath';
import { addCalendarMonths, dateOnly, normalizeMonthlyScheduleRows } from '@/lib/payments/scheduleDates';
import { getManageableVillages } from '@/lib/villages/getManageableVillages';

function formatDate(value) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function getPlanSchedule(plan) {
  const rows = plan.payment_schedule || [];
  return normalizeMonthlyScheduleRows(Array.isArray(rows) ? rows : []);
}

function getLedgerTermMonths(plan) {
  return Number(plan.installment_term_months || plan.reservations?.installment_term_months || 6);
}

function getLedgerMonthlyPayment(plan) {
  if (Number(plan.monthly_payment || 0) > 0) return Number(plan.monthly_payment);
  const remaining = Number(plan.remaining_balance || 0);
  const term = Math.max(1, getLedgerTermMonths(plan));
  return remaining > 0 ? remaining / term : 0;
}

function getFallbackNextDue(plan, schedule = []) {
  const paidRows = schedule
    .filter((row) => row.status === 'paid' && row.due_date)
    .sort((a, b) => new Date(b.due_date) - new Date(a.due_date));
  if (paidRows.length > 0) return dateOnly(addCalendarMonths(paidRows[0].due_date, 1));
  if (plan.next_due_date) return plan.next_due_date;
  const baseDate = plan.reservations?.approved_at || plan.reservations?.reserved_at || plan.start_date || plan.created_at;
  return dateOnly(addCalendarMonths(baseDate, 1));
}

function getLedgerStatus(plan) {
  const today = new Date().toISOString().slice(0, 10);
  const schedule = getPlanSchedule(plan);
  const openRows = schedule.filter((row) => ['unpaid', 'partially_paid', 'overdue'].includes(row.status));
  const overdueRows = openRows.filter((row) => row.due_date < today);
  const scheduledNextDue = [...openRows].sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0] || null;
  const fallbackNextDue = Number(plan.remaining_balance || 0) > 0
    ? {
        due_date: getFallbackNextDue(plan, schedule),
        remaining_due: getLedgerMonthlyPayment(plan),
        amount_due: getLedgerMonthlyPayment(plan),
        status: 'unpaid'
      }
    : null;
  const nextDue = scheduledNextDue || fallbackNextDue;
  const daysUntilDue = nextDue ? Math.ceil((new Date(nextDue.due_date) - new Date(today)) / 86400000) : null;

  if (overdueRows.length > 0 || plan.status === 'overdue') {
    return {
      label: 'Overdue',
      tone: 'border-red-200 bg-red-50 text-red-700',
      nextDue,
      overdueRows,
      messageType: 'overdue',
      canNotify: true
    };
  }

  if (nextDue && daysUntilDue <= 7) {
    return {
      label: 'Due Soon',
      tone: 'border-amber-200 bg-amber-50 text-amber-700',
      nextDue,
      overdueRows,
      messageType: 'payment_reminder',
      canNotify: true
    };
  }

  if (plan.status === 'fully_paid') {
    return {
      label: 'Fully Paid',
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      nextDue,
      overdueRows,
      messageType: 'payment_reminder',
      canNotify: false
    };
  }

  return {
    label: nextDue ? 'Current' : 'No Due',
    tone: 'border-slate-200 bg-slate-50 text-slate-600',
    nextDue,
    overdueRows,
    messageType: 'payment_reminder',
    canNotify: Boolean(nextDue)
  };
}

export default function AccountingDashboardPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [villages, setVillages] = useState([]);
  const [selectedVillageId, setSelectedVillageId] = useState('');
  const [scopeError, setScopeError] = useState('');
  const [payments, setPayments] = useState([]);
  const [accountPlans, setAccountPlans] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [reviewingDocumentId, setReviewingDocumentId] = useState(null);
  const [notifyingPlanId, setNotifyingPlanId] = useState(null);
  const [cashPlan, setCashPlan] = useState(null);
  const [cashAmount, setCashAmount] = useState('');
  const [cashReceipt, setCashReceipt] = useState('');
  const [cashNotes, setCashNotes] = useState('');
  const [recordingCash, setRecordingCash] = useState(false);
  
  // Filtering states
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');

  // Audit Dialog state
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [orNumber, setOrNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [auditing, setAuditing] = useState(false);

  const fetchPayments = useCallback(async (villageId) => {
    if (!villageId) {
      setPayments([]);
      setAccountPlans([]);
      setDocuments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setScopeError('');
    try {
      const paymentsQuery = supabase
        .from('payments')
        .select('*, payment_plans(*), reservations(*, properties(*, villages(*)), profiles(full_name))')
        .eq('village_id', villageId)
        .order('created_at', { ascending: false });

      const plansQuery = supabase
        .from('payment_plans')
        .select('*, reservations(*, profiles(full_name, email, phone), properties(*, villages(*))), payment_schedule(*)')
        .eq('village_id', villageId)
        .order('created_at', { ascending: false });

      const documentsQuery = supabase
        .from('documents')
        .select('*, reservations(*, profiles(full_name, email), properties(*, villages(*)))')
        .order('uploaded_at', { ascending: false });

      const [
        { data: paymentRows, error: paymentsError },
        { data: planRows, error: plansError },
        { data: documentRows, error: documentsError }
      ] = await Promise.all([
        paymentsQuery,
        plansQuery,
        documentsQuery
      ]);

      if (paymentsError) throw paymentsError;
      if (plansError) throw plansError;
      if (documentsError) throw documentsError;

      setPayments(paymentRows || []);
      setAccountPlans(planRows || []);
      setDocuments((documentRows || []).filter((document) => document.reservations?.properties?.village_id === villageId));
    } catch (err) {
      console.error('Error fetching accounting dashboard data:', err);
      setScopeError(err.message || 'Payment audit data could not be loaded.');
      setPayments([]);
      setAccountPlans([]);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const handleNotifyCustomer = async (plan) => {
    const status = getLedgerStatus(plan);
    setNotifyingPlanId(plan.id);
    try {
      const response = await fetch('/api/accounting/customers/notify-due', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          messageType: status.messageType
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Customer notification failed.');
      }

      alert('Customer notification sent.');
    } catch (err) {
      alert(err.message || 'Customer notification failed.');
    } finally {
      setNotifyingPlanId(null);
    }
  };

  const handleReviewDocument = async (document, status) => {
    const rejectionReason = status === 'rejected'
      ? window.prompt('Why is this document being rejected?')
      : '';

    if (status === 'rejected' && !rejectionReason?.trim()) return;

    setReviewingDocumentId(document.id);
    try {
      const response = await fetch('/api/accounting/documents/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: document.id,
          status,
          rejectionReason
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Document review failed.');

      await fetchPayments(selectedVillageId);
    } catch (err) {
      alert(err.message || 'Document review failed.');
    } finally {
      setReviewingDocumentId(null);
    }
  };

  const openCashPayment = (plan) => {
    const status = getLedgerStatus(plan);
    const amount = status.nextDue ? Number(status.nextDue.remaining_due || status.nextDue.amount_due || 0) : getLedgerMonthlyPayment(plan);
    setCashPlan({ plan, status });
    setCashAmount(amount ? String(amount) : '');
    setCashReceipt('');
    setCashNotes('');
  };

  const closeCashPayment = () => {
    if (recordingCash) return;
    setCashPlan(null);
    setCashAmount('');
    setCashReceipt('');
    setCashNotes('');
  };

  const handleRecordCashPayment = async (event) => {
    event.preventDefault();
    if (!cashPlan) return;

    setRecordingCash(true);
    try {
      const response = await fetch('/api/accounting/payments/record-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentPlanId: cashPlan.plan.id,
          paymentScheduleId: cashPlan.status.nextDue?.id || null,
          amount: Number(cashAmount),
          officialReceiptNumber: cashReceipt,
          notes: cashNotes
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Cash payment could not be recorded.');

      alert('Cash payment recorded and ledger advanced.');
      closeCashPayment();
      await fetchPayments(selectedVillageId);
    } catch (err) {
      alert(err.message || 'Cash payment could not be recorded.');
    } finally {
      setRecordingCash(false);
    }
  };

  useEffect(() => {
    async function initializeVillageScope() {
      setLoading(true);
      try {
        const {
          data: { user }
        } = await supabase.auth.getUser();
        if (!user) return;

        const manageableVillages = await getManageableVillages(supabase, user.id);
        setVillages(manageableVillages);
        setSelectedVillageId((current) => current || manageableVillages[0]?.id || '');

        if (manageableVillages.length === 0) {
          setScopeError('No village community is assigned to this account.');
          setLoading(false);
        }
      } catch (err) {
        setScopeError(err.message || 'Village access could not be loaded.');
        setLoading(false);
      }
    }

    Promise.resolve().then(initializeVillageScope);
  }, [supabase]);

  useEffect(() => {
    if (selectedVillageId) {
      Promise.resolve().then(() => fetchPayments(selectedVillageId));
    }
  }, [fetchPayments, selectedVillageId]);

  // Auditing Action: VERIFY PAYMENT
  const handleVerifyPayment = async (payId, reservationId, propertyId) => {
    setAuditing(true);
    try {
      const response = await fetch('/api/accounting/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: payId,
          reservationId,
          propertyId,
          officialReceiptNumber: orNumber || generateReceiptNumber(),
          notes
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Payment verification failed.');
      }

      setOrNumber('');
      setNotes('');
      setSelectedPayment(null);
      fetchPayments(selectedVillageId);
    } catch (err) {
      alert(err.message || 'Audit verification failed.');
    } finally {
      setAuditing(false);
    }
  };

  // Auditing Action: REJECT PAYMENT
  const handleRejectPayment = async (payId) => {
    if (!rejectionReason) {
      alert('Please specify a rejection reason.');
      return;
    }
    setAuditing(true);
    try {
      const response = await fetch('/api/accounting/payments/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: payId, rejectionReason })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Payment rejection failed.');

      setRejectionReason('');
      setSelectedPayment(null);
      fetchPayments(selectedVillageId);
    } catch (err) {
      alert(err.message || 'Rejection audit failed.');
    } finally {
      setAuditing(false);
    }
  };

  const displayedPayments = payments;

  const getPaymentCustomerKey = (payment) => {
    const reservation = payment?.reservations || {};
    return reservation.profiles?.id || payment?.customer_id || reservation.guest_email || reservation.guest_name || 'guest';
  };

  const getPlanCustomerKey = (plan) => {
    const reservation = plan?.reservations || {};
    return reservation.profiles?.id || plan?.customer_id || reservation.guest_email || reservation.guest_name || 'guest';
  };

  const getDocumentCustomerKey = (document) => {
    const reservation = document?.reservations || {};
    return reservation.profiles?.id || document?.customer_id || reservation.guest_email || reservation.guest_name || 'guest';
  };

  const customerOptions = useMemo(() => {
    const options = new Map();

    displayedPayments.forEach((payment) => {
      const reservation = payment.reservations || {};
      const key = getPaymentCustomerKey(payment);
      options.set(key, {
        key,
        name: reservation.profiles?.full_name || reservation.guest_name || 'Guest Buyer',
        email: reservation.profiles?.email || reservation.guest_email || ''
      });
    });

    accountPlans.forEach((plan) => {
      const reservation = plan.reservations || {};
      const key = getPlanCustomerKey(plan);
      options.set(key, {
        key,
        name: reservation.profiles?.full_name || reservation.guest_name || 'Guest Buyer',
        email: reservation.profiles?.email || reservation.guest_email || ''
      });
    });

    documents.forEach((document) => {
      const reservation = document.reservations || {};
      const key = getDocumentCustomerKey(document);
      options.set(key, {
        key,
        name: reservation.profiles?.full_name || reservation.guest_name || 'Guest Buyer',
        email: reservation.profiles?.email || reservation.guest_email || ''
      });
    });

    return [...options.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [displayedPayments, accountPlans, documents]);

  // Filter payments
  const filteredPayments = displayedPayments.filter((p) => {
    if (statusFilter && p.payment_status !== statusFilter) return false;
    if (methodFilter && p.payment_method !== methodFilter) return false;
    if (customerFilter && getPaymentCustomerKey(p) !== customerFilter) return false;
    return true;
  });

  const filteredAccountPlans = accountPlans.filter((plan) => {
    if (!customerFilter) return true;
    return getPlanCustomerKey(plan) === customerFilter;
  });

  const filteredDocuments = documents.filter((document) => {
    if (!customerFilter) return true;
    return getDocumentCustomerKey(document) === customerFilter;
  });

  // Export Sales ledger to CSV
  const handleExportCSV = () => {
    const headers = ['OR Number', 'Reservation Code', 'Customer', 'Subdivision', 'Property Code', 'Amount', 'Method', 'Reference ID', 'Status', 'Date'];
    const rows = filteredPayments.map(p => [
      p.official_receipt_number || 'N/A',
      p.reservations?.reservation_code || 'N/A',
      p.reservations?.profiles?.full_name || 'Guest User',
      p.reservations?.properties?.villages?.name || 'N/A',
      p.reservations?.properties?.property_code || 'N/A',
      p.amount,
      p.payment_method,
      p.reference_number || 'N/A',
      p.payment_status,
      new Date(p.created_at).toLocaleDateString()
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sales-ledger-audit.csv';
    a.click();
  };

  const pendingCount = filteredPayments.filter(p => p.payment_status === 'pending_verification').length;
  const verifiedCount = filteredPayments.filter(p => p.payment_status === 'verified').length;
  const totalCollections = filteredPayments.filter(p => p.payment_status === 'verified').reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  return (
    <DashboardShell>
      <div className="space-y-6">
        
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-900 pb-5">
          <div>
            <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
              <CreditCard className="w-8 h-8 text-emerald-400" />
              Payments / Booking Audit
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Review and manage payment records for one village community at a time.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              <span className="mb-1.5 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-emerald-400" />
                Village Community
              </span>
              <select
                value={selectedVillageId}
                onChange={(event) => {
                  setSelectedVillageId(event.target.value);
                  setStatusFilter('');
                  setMethodFilter('');
                  setCustomerFilter('');
                }}
                disabled={villages.length === 0}
                className="min-w-64 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs font-bold normal-case tracking-normal text-slate-200 outline-none focus:border-emerald-500/50 disabled:opacity-50"
              >
                {villages.length === 0 ? (
                  <option value="">No assigned villages</option>
                ) : villages.map((village) => (
                  <option key={village.id} value={village.id}>{village.name}</option>
                ))}
              </select>
            </label>
            <button
              onClick={handleExportCSV}
              disabled={!selectedVillageId || loading}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-200 shadow transition hover:border-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export Village Ledger
            </button>
          </div>
        </div>

        {scopeError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs font-bold text-red-400">
            <AlertTriangle className="h-4 w-4" />
            {scopeError}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60 py-12">
            <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
          </div>
        )}

        {/* Audit Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center gap-4 shadow glass-card">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-inner">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Collections</span>
              <span className="text-2xl font-extrabold text-white mt-0.5">₱{totalCollections.toLocaleString()}</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center gap-4 shadow glass-card">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-inner">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Pending Verifications</span>
              <span className="text-2xl font-extrabold text-white mt-0.5">{pendingCount} payments</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center gap-4 shadow glass-card">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center shadow-inner">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Verified Deposits</span>
              <span className="text-2xl font-extrabold text-white mt-0.5">{verifiedCount} deposits</span>
            </div>
          </div>
        </div>

        {/* Filtering Options */}
        <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-4 flex flex-wrap gap-4 items-center glass-card">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold select-none">
            <Filter className="w-4 h-4 text-emerald-400" />
            <span>Filter Transactions:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950/60 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-slate-350 outline-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="pending_verification">Pending Audit</option>
            <option value="verified">Verified Ledger</option>
            <option value="rejected">Rejected Entries</option>
          </select>

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="bg-slate-950/60 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-slate-350 outline-none cursor-pointer"
          >
            <option value="">All Methods</option>
            <option value="gcash">GCash Transfer</option>
            <option value="maya">Maya Account</option>
            <option value="bank_transfer">Bank Wire</option>
          </select>

          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="min-w-56 bg-slate-950/60 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-slate-350 outline-none cursor-pointer"
          >
            <option value="">All Customers</option>
            {customerOptions.map((customer) => (
              <option key={customer.key} value={customer.key}>
                {customer.name}{customer.email ? ` - ${customer.email}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Customer Documents Review */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 glass-card space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <FileCheck className="w-4.5 h-4.5 text-emerald-400" />
                Customer Documents Approval
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Approve required documents before verifying a customer&apos;s first payment.
              </p>
            </div>
            <span className="rounded-full border border-slate-800 bg-slate-950/50 px-3 py-1 text-[10px] font-extrabold uppercase text-slate-500">
              {filteredDocuments.filter((document) => document.status === 'pending').length} pending
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs font-medium border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 select-none">
                  <th className="py-3 px-2">Customer</th>
                  <th className="py-3 px-2">Document</th>
                  <th className="py-3 px-2">Property</th>
                  <th className="py-3 px-2">Uploaded</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2 text-right">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {filteredDocuments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-xs font-semibold text-slate-500">
                      No customer documents found for this filter.
                    </td>
                  </tr>
                )}

                {filteredDocuments.map((document) => {
                  const reservation = document.reservations || {};
                  const property = reservation.properties || {};
                  return (
                    <tr key={document.id} className="hover:bg-slate-950/20 transition-colors">
                      <td className="py-3.5 px-2">
                        <span className="block font-bold text-slate-200">{reservation.profiles?.full_name || reservation.guest_name || 'Guest Buyer'}</span>
                        <span className="text-[10px] text-slate-500">{reservation.profiles?.email || reservation.guest_email || 'No email'}</span>
                      </td>
                      <td className="py-3.5 px-2">
                        <a href={document.file_url} target="_blank" rel="noreferrer" className="font-bold text-emerald-400 hover:text-emerald-300">
                          {document.document_type}
                        </a>
                        {document.rejection_reason && <span className="mt-1 block text-[10px] text-red-400">{document.rejection_reason}</span>}
                      </td>
                      <td className="py-3.5 px-2">
                        <span className="block text-slate-200">{property.villages?.name || 'Village'}</span>
                        <span className="text-[10px] text-slate-500">Block {property.block_number || '-'} Lot {property.lot_number || '-'}</span>
                      </td>
                      <td className="py-3.5 px-2 text-slate-500">
                        {document.uploaded_at ? new Date(document.uploaded_at).toLocaleDateString('en-PH') : '-'}
                      </td>
                      <td className="py-3.5 px-2">
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${
                          document.status === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : document.status === 'rejected'
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {document.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-right">
                        {document.status === 'pending' ? (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              disabled={reviewingDocumentId === document.id}
                              onClick={() => handleReviewDocument(document, 'approved')}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-[10px] font-extrabold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={reviewingDocumentId === document.id}
                              onClick={() => handleReviewDocument(document, 'rejected')}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[10px] font-extrabold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                            >
                              <X className="h-3.5 w-3.5" />
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-semibold select-none italic">
                            Reviewed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Ledger Table */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 glass-card space-y-4">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="w-4.5 h-4.5 text-emerald-400" />
            Receipts Audit Ledger
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 select-none">
                  <th className="py-3 px-2">Reservation Info</th>
                  <th className="py-3 px-2">Customer / Client</th>
                  <th className="py-3 px-2">Subdivision & Plot</th>
                  <th className="py-3 px-2">Deposit Fee</th>
                  <th className="py-3 px-2">Transfer Method</th>
                  <th className="py-3 px-2">Reference ID</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2 text-right">Audit Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {filteredPayments.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-xs font-semibold text-slate-500">
                      No accounting reservation payments found.
                    </td>
                  </tr>
                )}
                {filteredPayments.map((p) => {
                  const res = p.reservations || {};
                  const prop = res.properties || {};
                  return (
                    <tr key={p.id} className="hover:bg-slate-950/20 transition-colors">
                      <td className="py-3.5 px-2 font-mono font-semibold text-emerald-400">{res.reservation_code}</td>
                      <td className="py-3.5 px-2 text-slate-250 font-semibold">{res.profiles?.full_name || 'Guest Buyer'}</td>
                      <td className="py-3.5 px-2">
                        <span className="block text-slate-200">{prop.villages?.name || 'Smart Subd'}</span>
                        <span className="text-[10px] text-slate-500">Block {prop.block_number} Lot {prop.lot_number}</span>
                      </td>
                      <td className="py-3.5 px-2 font-bold text-white">₱{p.amount?.toLocaleString()}</td>
                      <td className="py-3.5 px-2 uppercase text-slate-400">{p.payment_method?.replace('_', ' ')}</td>
                      <td className="py-3.5 px-2 font-mono text-slate-500">{p.reference_number || 'N/A'}</td>
                      <td className="py-3.5 px-2">
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                          p.payment_status === 'verified' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : p.payment_status === 'rejected'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {p.payment_status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-right">
                        {p.payment_status === 'pending_verification' ? (
                          <button
                            onClick={() => setSelectedPayment(p)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold rounded-lg transition cursor-pointer"
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                            Audit
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-semibold select-none italic">
                            Receipt: {p.official_receipt_number || 'Logged'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Customer Account Ledger */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 glass-card space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <CalendarClock className="w-4.5 h-4.5 text-emerald-400" />
                Customer Account Ledger
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                View customer balances, monthly dues, upcoming payments, and overdue accounts.
              </p>
            </div>
            <span className="rounded-full border border-slate-800 bg-slate-950/50 px-3 py-1 text-[10px] font-extrabold uppercase text-slate-500">
              {filteredAccountPlans.length} accounts
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-xs font-medium border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 select-none">
                  <th className="py-3 px-2">Customer</th>
                  <th className="py-3 px-2">Property</th>
                  <th className="py-3 px-2">Payable Balance</th>
                  <th className="py-3 px-2">Monthly Payment</th>
                  <th className="py-3 px-2">Next Due</th>
                  <th className="py-3 px-2">Overdue</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {filteredAccountPlans.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-xs font-semibold text-slate-500">
                      No customer account ledgers found yet.
                    </td>
                  </tr>
                )}

                {filteredAccountPlans.map((plan) => {
                  const status = getLedgerStatus(plan);
                  const reservation = plan.reservations || {};
                  const property = reservation.properties || {};
                  const customer = reservation.profiles || {};
                  const overdueAmount = status.overdueRows.reduce((sum, row) => sum + Number(row.remaining_due || row.amount_due || 0), 0);
                  const nextDueAmount = status.nextDue ? Number(status.nextDue.remaining_due || status.nextDue.amount_due || 0) : 0;
                  const monthlyPayment = getLedgerMonthlyPayment(plan);

                  return (
                    <tr key={plan.id} className="hover:bg-slate-950/20 transition-colors">
                      <td className="py-3.5 px-2">
                        <span className="block font-bold text-slate-200">{customer.full_name || reservation.guest_name || 'Guest Buyer'}</span>
                        <span className="text-[10px] text-slate-500">{customer.email || reservation.guest_email || 'No email'}</span>
                      </td>
                      <td className="py-3.5 px-2">
                        <span className="block font-bold text-slate-200">{property.property_code || reservation.reservation_code}</span>
                        <span className="text-[10px] text-slate-500">{property.villages?.name || 'Village'} B{property.block_number || '-'} L{property.lot_number || '-'}</span>
                      </td>
                      <td className="py-3.5 px-2 font-extrabold text-white">{formatPeso(plan.remaining_balance)}</td>
                      <td className="py-3.5 px-2">
                        {monthlyPayment > 0 ? (
                          <span>
                            <span className="block font-bold text-slate-200">{formatPeso(monthlyPayment)}</span>
                            <span className="text-[10px] text-slate-500">for {getLedgerTermMonths(plan)} months</span>
                          </span>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="py-3.5 px-2">
                        <span className="block">{status.nextDue ? formatDate(status.nextDue.due_date) : 'No due scheduled'}</span>
                        {status.nextDue && <span className="text-[10px] text-slate-500">{formatPeso(nextDueAmount)}</span>}
                      </td>
                      <td className="py-3.5 px-2">
                        {status.overdueRows.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-red-500 font-bold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {status.overdueRows.length} due / {formatPeso(overdueAmount)}
                          </span>
                        ) : (
                          <span className="text-slate-500">None</span>
                        )}
                      </td>
                      <td className="py-3.5 px-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase ${status.tone}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          disabled={!status.nextDue || monthlyPayment <= 0}
                          onClick={() => openCashPayment(plan)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-white px-3 py-1.5 text-[10px] font-extrabold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Coins className="w-3.5 h-3.5" />
                          Record Cash
                        </button>
                        <button
                          type="button"
                          disabled={!plan.customer_id || !status.canNotify || notifyingPlanId === plan.id}
                          onClick={() => handleNotifyCustomer(plan)}
                          title={!plan.customer_id ? 'Guest reservations are not linked to a customer notification inbox.' : undefined}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-extrabold text-emerald-600 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <BellRing className="w-3.5 h-3.5" />
                          {notifyingPlanId === plan.id ? 'Sending...' : 'Notify'}
                        </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {cashPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm">
            <form
              onSubmit={handleRecordCashPayment}
              className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-800 bg-white shadow-2xl"
            >
              <div className="border-b border-slate-200 px-5 py-4">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">Accounting Cash Payment</p>
                <h3 className="mt-1 text-lg font-extrabold text-slate-900">
                  {cashPlan.plan.reservations?.profiles?.full_name || cashPlan.plan.reservations?.guest_name || 'Customer Account'}
                </h3>
              </div>

              <div className="space-y-4 p-5">
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                  <div>
                    <p className="font-bold uppercase tracking-wider text-slate-500">Property</p>
                    <p className="mt-1 font-extrabold text-slate-900">{cashPlan.plan.reservations?.properties?.property_code || cashPlan.plan.reservations?.reservation_code}</p>
                  </div>
                  <div>
                    <p className="font-bold uppercase tracking-wider text-slate-500">Next Due</p>
                    <p className="mt-1 font-extrabold text-slate-900">{formatDate(cashPlan.status.nextDue?.due_date)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Cash Amount</label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="0.01"
                      value={cashAmount}
                      onChange={(event) => setCashAmount(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">OR / Receipt No.</label>
                    <input
                      type="text"
                      value={cashReceipt}
                      onChange={(event) => setCashReceipt(event.target.value)}
                      placeholder="Auto if blank"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Accounting Notes</label>
                  <textarea
                    rows={3}
                    value={cashNotes}
                    onChange={(event) => setCashNotes(event.target.value)}
                    placeholder="Cash received at office, collector name, or other audit notes."
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-slate-200 bg-slate-50 p-4">
                <button
                  type="button"
                  onClick={closeCashPayment}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordingCash}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {recordingCash ? 'Recording...' : 'Record Cash Payment'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Interactive Audit Verification Modal */}
        {selectedPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm">
            <div className="relative z-10 flex max-h-[calc(100vh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl glass-card animate-in fade-in zoom-in-95 duration-200">
              <div className="flex-shrink-0 border-b border-slate-850 bg-white/90 px-4 py-3 backdrop-blur">
              <h3 className="text-sm font-extrabold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                <FileCheck className="w-4.5 h-4.5 text-emerald-400" />
                Audit Hold Deposit Receipt
              </h3>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              <div className="grid grid-cols-1 gap-3 text-xs">
                <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Customer Name</span>
                  <span className="font-semibold text-slate-350 block mt-0.5">{selectedPayment.reservations?.profiles?.full_name || 'Guest Buyer'}</span>
                </div>
                <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Reservation code</span>
                  <span className="font-mono text-emerald-400 font-bold block mt-0.5">{selectedPayment.reservations?.reservation_code}</span>
                </div>
                <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Property details</span>
                  <span className="font-semibold text-slate-350 block mt-0.5">
                    {selectedPayment.reservations?.properties?.property_code} (B{selectedPayment.reservations?.properties?.block_number} L{selectedPayment.reservations?.properties?.lot_number})
                  </span>
                </div>
                <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Hold deposit amount</span>
                  <span className="font-bold text-white block mt-0.5">₱{selectedPayment.amount?.toLocaleString()}</span>
                </div>
              </div>

              <PaymentVerificationPanel plan={selectedPayment.payment_plans} />

              {/* Input for OR Number */}
              <div className="space-y-4 text-xs font-semibold">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Record OR Number</label>
                  <input
                    type="text"
                    value={orNumber}
                    onChange={(e) => setOrNumber(e.target.value)}
                    placeholder="e.g. OR-789012 (Leave blank for auto-generation)"
                    className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/50 rounded-xl p-2.5 outline-none text-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Audit internal notes</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter audit check verification comments..."
                    className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/50 rounded-xl p-2.5 outline-none text-slate-300 resize-none"
                  />
                </div>

                <hr className="border-slate-850" />

                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 text-red-400">Specify Rejection Reason (If rejecting)</label>
                  <input
                    type="text"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Invalid reference code or incomplete slip image."
                    className="w-full bg-slate-950/50 border border-slate-800 focus:border-red-500/50 rounded-xl p-2.5 outline-none text-slate-300"
                  />
                </div>
              </div>

              </div>

              {/* Action buttons */}
              <div className="grid flex-shrink-0 grid-cols-1 gap-2 border-t border-slate-850 bg-white/95 p-3 backdrop-blur sm:grid-cols-3">
                <button
                  onClick={() => setSelectedPayment(null)}
                  className="rounded-xl border border-slate-800 px-4 py-2.5 text-xs font-bold text-slate-400 outline-none transition hover:text-white cursor-pointer"
                >
                  Close
                </button>
                <button
                  disabled={auditing}
                  onClick={() => handleRejectPayment(selectedPayment.id)}
                  className="flex items-center justify-center gap-1 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs font-bold text-red-400 outline-none transition hover:bg-red-500/20 cursor-pointer disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                  Reject Receipt
                </button>
                <button
                  disabled={auditing}
                  onClick={() => handleVerifyPayment(
                    selectedPayment.id,
                    selectedPayment.reservation_id,
                    selectedPayment.reservations?.properties?.id
                  )}
                  className="flex items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-xs font-bold text-slate-950 outline-none transition hover:from-emerald-400 hover:to-teal-500 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  Verify Deposit
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardShell>
  );
}

function generateReceiptNumber() {
  return `OR-${Math.floor(Math.random() * 900000) + 100000}`;
}
