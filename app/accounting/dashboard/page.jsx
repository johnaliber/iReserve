'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import DashboardShell from '@/components/layout/DashboardShell';
import { 
  AlertCircle,
  AlertTriangle,
  BellRing,
  Building2,
  CalendarClock,
  BookOpen,
  CreditCard, 
  Check, 
  X, 
  Coins, 
  ShieldCheck, 
  Filter, 
  Download,
  ExternalLink,
  Eye,
  FileCheck,
  FileText,
  ReceiptText,
  Users,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import PaymentVerificationPanel from '@/components/accounting/PaymentVerificationPanel';
import { formatPeso } from '@/lib/payments/paymentMath';
import { addCalendarMonths, dateOnly, normalizeMonthlyScheduleRows } from '@/lib/payments/scheduleDates';
import { getManageableVillages } from '@/lib/villages/getManageableVillages';
import { useRealtimeTable } from '@/lib/realtime/useRealtimeTable';
import { useRealtimeRefresh } from '@/lib/realtime/useRealtimeRefresh';

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
  if (plan?.payment_type === 'full_payment') return 0;
  return Number(plan.installment_term_months || plan.reservations?.installment_term_months || 6);
}

function getLedgerMonthlyPayment(plan) {
  if (plan?.payment_type === 'full_payment') return 0;
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
  const usesSchedule = plan?.payment_type !== 'full_payment';
  const openRows = schedule.filter((row) => ['unpaid', 'partially_paid', 'overdue'].includes(row.status));
  const overdueRows = openRows.filter((row) => row.due_date < today);
  const scheduledNextDue = [...openRows].sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0] || null;
  const fallbackNextDue = usesSchedule && Number(plan.remaining_balance || 0) > 0
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
      tone: 'border-[#fecaca] bg-[#fff7f7] text-[#b42318]',
      nextDue,
      overdueRows,
      messageType: 'overdue',
      canNotify: true
    };
  }

  if (nextDue && daysUntilDue <= 7) {
    return {
      label: 'Due Soon',
      tone: 'border-[#fde7b2] bg-[#fffbeb] text-[#9a6700]',
      nextDue,
      overdueRows,
      messageType: 'payment_reminder',
      canNotify: true
    };
  }

  if (plan.status === 'fully_paid') {
    return {
      label: 'Fully Paid',
      tone: 'border-[#b7e4d2] bg-[#f0faf6] text-[#13795b]',
      nextDue,
      overdueRows,
      messageType: 'payment_reminder',
      canNotify: false
    };
  }

  if (plan.payment_type === 'full_payment' && Number(plan.remaining_balance || 0) > 0) {
    return {
      label: 'Balance Due',
      tone: 'border-[#fde7b2] bg-[#fffbeb] text-[#9a6700]',
      nextDue: null,
      overdueRows,
      messageType: 'full_balance_due',
      canNotify: true,
      fullBalanceDue: Number(plan.remaining_balance || 0)
    };
  }

  return {
    label: nextDue ? 'Current' : 'No Due',
    tone: 'border-[#dce4e0] bg-[#f4f7f5] text-[#52635b]',
    nextDue,
    overdueRows,
    messageType: 'payment_reminder',
    canNotify: Boolean(nextDue)
  };
}

const VIEW_CONFIG = {
  dashboard: {
    title: 'Accounting Dashboard',
    subtitle: 'Monitor collections, pending reviews, documents, and overdue customer accounts.',
    icon: CreditCard
  },
  accounts: {
    title: 'Customer Account Ledger',
    subtitle: 'View customer balances, monthly dues, upcoming payments, and overdue accounts.',
    icon: CalendarClock
  },
  receipts: {
    title: 'Receipts Audit Ledger',
    subtitle: 'Review verified receipts, payment references, transfer methods, and audit records.',
    icon: ReceiptText
  },
  documents: {
    title: 'Customer Documents',
    subtitle: 'Review and approve required customer documents before payment verification or reservation approval.',
    icon: FileCheck
  }
};

export default function AccountingDashboardPage({ view = 'dashboard' }) {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [villages, setVillages] = useState([]);
  const [selectedVillageId, setSelectedVillageId] = useState('');
  const [scopeError, setScopeError] = useState('');
  const [payments, setPayments] = useState([]);
  const [accountPlans, setAccountPlans] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [reviewingDocumentId, setReviewingDocumentId] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [documentReviewDecision, setDocumentReviewDecision] = useState('');
  const [documentRejectionReason, setDocumentRejectionReason] = useState('');
  const [notifyingPlanId, setNotifyingPlanId] = useState(null);
  const [cashPlan, setCashPlan] = useState(null);
  const [cashAmount, setCashAmount] = useState('');
  const [cashReceipt, setCashReceipt] = useState('');
  const [cashNotes, setCashNotes] = useState('');
  const [recordingCash, setRecordingCash] = useState(false);
  const [actionAlert, setActionAlert] = useState(null);
  
  // Filtering states
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('');
  const [accountStatusFilter, setAccountStatusFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [accountDateFrom, setAccountDateFrom] = useState('');
  const [accountDateTo, setAccountDateTo] = useState('');
  const [accountSort, setAccountSort] = useState('next_due');
  const [referenceFilter, setReferenceFilter] = useState('');
  const [receiptFilter, setReceiptFilter] = useState('');
  const [receiptDateFrom, setReceiptDateFrom] = useState('');
  const [receiptDateTo, setReceiptDateTo] = useState('');
  const [documentStatusFilter, setDocumentStatusFilter] = useState('');
  const [documentTypeFilter, setDocumentTypeFilter] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [pendingDocumentsOnly, setPendingDocumentsOnly] = useState(false);
  const [statementPlan, setStatementPlan] = useState(null);

  // Audit Dialog state
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [orNumber, setOrNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [auditing, setAuditing] = useState(false);

  useEffect(() => {
    if (!actionAlert) return undefined;
    const timer = window.setTimeout(() => setActionAlert(null), 6000);
    return () => window.clearTimeout(timer);
  }, [actionAlert]);

  const fetchPayments = useCallback(async (
    villageId,
    {
      showLoading = true,
      reconcile = true,
      clearOnError = true
    } = {}
  ) => {
    if (!villageId) {
      setPayments([]);
      setAccountPlans([]);
      setDocuments([]);
      if (showLoading) setLoading(false);
      return;
    }

    if (showLoading) setLoading(true);
    if (showLoading) setScopeError('');
    try {
      if (reconcile) {
        const reconcileResponse = await fetch('/api/accounting/customer-accounts/reconcile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ villageId })
        });
        if (!reconcileResponse.ok) {
          const reconcilePayload = await reconcileResponse.json().catch(() => ({}));
          console.warn('Customer ledger reconciliation skipped:', reconcilePayload.error || reconcileResponse.statusText);
        }
      }

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
      if (showLoading) {
        setScopeError(err.message || 'Payment audit data could not be loaded.');
      }
      if (clearOnError) {
        setPayments([]);
        setAccountPlans([]);
        setDocuments([]);
      }
    } finally {
      if (showLoading) setLoading(false);
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

      if (payload.email?.sent) {
        setActionAlert({
          type: 'success',
          title: 'Customer notified',
          message: 'The in-app notification and email were sent successfully.'
        });
      } else {
        setActionAlert({
          type: 'warning',
          title: 'In-app notification sent',
          message: 'The customer was notified in iReserve, but the email was not delivered. Check the Gmail SMTP configuration.'
        });
      }
    } catch (err) {
      setActionAlert({
        type: 'error',
        title: 'Notification failed',
        message: err.message || 'The customer notification could not be sent.'
      });
    } finally {
      setNotifyingPlanId(null);
    }
  };

  const openDocumentReview = (document) => {
    setSelectedDocument(document);
    setDocumentReviewDecision('');
    setDocumentRejectionReason('');
  };

  const closeDocumentReview = () => {
    if (reviewingDocumentId) return;
    setSelectedDocument(null);
    setDocumentReviewDecision('');
    setDocumentRejectionReason('');
  };

  const handleReviewDocument = async (status) => {
    if (!selectedDocument) return;
    if (status === 'rejected' && !documentRejectionReason.trim()) {
      setActionAlert({
        type: 'warning',
        title: 'Rejection reason required',
        message: 'Explain what is wrong with the document so the customer knows what to upload again.'
      });
      return;
    }

    setReviewingDocumentId(selectedDocument.id);
    try {
      const response = await fetch('/api/accounting/documents/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDocument.id,
          status,
          rejectionReason: status === 'rejected' ? documentRejectionReason.trim() : '',
          reviewConfirmed: true
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Document review failed.');

      setActionAlert({
        type: 'success',
        title: status === 'approved' ? 'Document approved' : 'Document rejected',
        message: status === 'approved'
          ? 'The document was approved and the customer record was updated.'
          : 'The document was rejected and the customer was notified with the reason.'
      });
      setSelectedDocument(null);
      setDocumentReviewDecision('');
      setDocumentRejectionReason('');
      await fetchPayments(selectedVillageId, {
        showLoading: false,
        reconcile: false,
        clearOnError: false
      });
    } catch (err) {
      setActionAlert({
        type: 'error',
        title: 'Document review failed',
        message: err.message || 'The document review could not be saved.'
      });
    } finally {
      setReviewingDocumentId(null);
    }
  };

  const openCashPayment = (plan) => {
    const status = getLedgerStatus(plan);
    const amount = plan.payment_type === 'full_payment'
      ? Number(plan.remaining_balance || 0)
      : status.nextDue
        ? Number(status.nextDue.remaining_due || status.nextDue.amount_due || 0)
        : getLedgerMonthlyPayment(plan);
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

      setActionAlert({
        type: 'success',
        title: 'Cash payment recorded',
        message: 'The ledger was updated and the customer was notified.'
      });
      setCashPlan(null);
      setCashAmount('');
      setCashReceipt('');
      setCashNotes('');
      await fetchPayments(selectedVillageId, {
        showLoading: false,
        reconcile: false,
        clearOnError: false
      });
    } catch (err) {
      setActionAlert({
        type: 'error',
        title: 'Cash payment not recorded',
        message: err.message || 'The cash payment could not be recorded.'
      });
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
  const refreshAccountingData = useCallback(() => {
    if (selectedVillageId) {
      fetchPayments(selectedVillageId, {
        showLoading: false,
        reconcile: false,
        clearOnError: false
      });
    }
  }, [fetchPayments, selectedVillageId]);
  const scheduleAccountingRefresh = useRealtimeRefresh(refreshAccountingData, 350);
  const accountingRealtimeStatus = useRealtimeTable({
    table: 'payments',
    filter: selectedVillageId ? `village_id=eq.${selectedVillageId}` : undefined,
    onChange: scheduleAccountingRefresh,
    enabled: Boolean(selectedVillageId)
  });
  useRealtimeTable({
    table: 'payment_plans',
    filter: selectedVillageId ? `village_id=eq.${selectedVillageId}` : undefined,
    onChange: scheduleAccountingRefresh,
    enabled: Boolean(selectedVillageId)
  });
  useRealtimeTable({ table: 'payment_schedule', onChange: scheduleAccountingRefresh, enabled: Boolean(selectedVillageId) });
  useRealtimeTable({ table: 'documents', onChange: scheduleAccountingRefresh, enabled: Boolean(selectedVillageId) });
  useRealtimeTable({ table: 'refunds', onChange: scheduleAccountingRefresh, enabled: Boolean(selectedVillageId) });
  useRealtimeTable({
    table: 'reservations',
    filter: selectedVillageId ? `village_id=eq.${selectedVillageId}` : undefined,
    onChange: scheduleAccountingRefresh,
    enabled: Boolean(selectedVillageId)
  });

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
      fetchPayments(selectedVillageId, {
        showLoading: false,
        reconcile: false,
        clearOnError: false
      });
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
      fetchPayments(selectedVillageId, {
        showLoading: false,
        reconcile: false,
        clearOnError: false
      });
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

  const propertyOptions = useMemo(() => {
    const options = new Map();
    [
      ...displayedPayments.map((payment) => payment.reservations?.properties),
      ...accountPlans.map((plan) => plan.reservations?.properties),
      ...documents.map((document) => document.reservations?.properties)
    ]
      .filter(Boolean)
      .forEach((property) => {
        options.set(property.id, {
          id: property.id,
          label: `${property.property_code || 'Property'} - Block ${property.block_number || '-'} Lot ${property.lot_number || '-'}`
        });
      });
    return [...options.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [displayedPayments, accountPlans, documents]);

  const documentTypes = useMemo(
    () => [...new Set(documents.map((document) => document.document_type).filter(Boolean))].sort(),
    [documents]
  );

  // Filter payments
  const filteredPayments = displayedPayments.filter((p) => {
    if (statusFilter && p.payment_status !== statusFilter) return false;
    if (methodFilter && p.payment_method !== methodFilter) return false;
    if (customerFilter && getPaymentCustomerKey(p) !== customerFilter) return false;
    if (referenceFilter && !String(p.reference_number || '').toLowerCase().includes(referenceFilter.toLowerCase())) return false;
    if (receiptFilter && !String(p.official_receipt_number || '').toLowerCase().includes(receiptFilter.toLowerCase())) return false;
    const paymentDate = String(p.created_at || '').slice(0, 10);
    if (receiptDateFrom && paymentDate < receiptDateFrom) return false;
    if (receiptDateTo && paymentDate > receiptDateTo) return false;
    return true;
  });

  const filteredAccountPlans = accountPlans
    .filter((plan) => {
      const ledgerStatus = getLedgerStatus(plan);
      if (customerFilter && getPlanCustomerKey(plan) !== customerFilter) return false;
      if (propertyFilter && plan.reservations?.properties?.id !== propertyFilter) return false;
      if (accountStatusFilter && ledgerStatus.label.toLowerCase().replace(' ', '_') !== accountStatusFilter) return false;
      if (overdueOnly && ledgerStatus.overdueRows.length === 0 && plan.status !== 'overdue') return false;
      const dueDate = String(ledgerStatus.nextDue?.due_date || '');
      if (accountDateFrom && (!dueDate || dueDate < accountDateFrom)) return false;
      if (accountDateTo && (!dueDate || dueDate > accountDateTo)) return false;
      return true;
    })
    .sort((left, right) => {
      if (accountSort === 'balance_desc') return Number(right.remaining_balance || 0) - Number(left.remaining_balance || 0);
      if (accountSort === 'balance_asc') return Number(left.remaining_balance || 0) - Number(right.remaining_balance || 0);
      const leftDue = getLedgerStatus(left).nextDue?.due_date || '9999-12-31';
      const rightDue = getLedgerStatus(right).nextDue?.due_date || '9999-12-31';
      return leftDue.localeCompare(rightDue);
    });

  const filteredDocuments = documents.filter((document) => {
    if (customerFilter && getDocumentCustomerKey(document) !== customerFilter) return false;
    if (documentStatusFilter && document.status !== documentStatusFilter) return false;
    if (pendingDocumentsOnly && document.status !== 'pending') return false;
    if (documentTypeFilter && document.document_type !== documentTypeFilter) return false;
    if (propertyFilter && document.reservations?.properties?.id !== propertyFilter) return false;
    if (documentDate && String(document.uploaded_at || '').slice(0, 10) !== documentDate) return false;
    return true;
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
  const pendingDocumentsCount = documents.filter((document) => document.status === 'pending').length;
  const overdueAccountsCount = accountPlans.filter((plan) => {
    const status = getLedgerStatus(plan);
    return status.overdueRows.length > 0 || plan.status === 'overdue';
  }).length;
  const viewConfig = VIEW_CONFIG[view] || VIEW_CONFIG.dashboard;
  const ViewIcon = viewConfig.icon;

  return (
    <DashboardShell>
      {actionAlert && (
        <div className="fixed right-4 top-4 z-[120] w-[calc(100%-2rem)] max-w-md">
          <div
            role="status"
            className={`flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-2xl ${
              actionAlert.type === 'success'
                ? 'border-emerald-200'
                : actionAlert.type === 'warning'
                  ? 'border-amber-200'
                  : 'border-rose-200'
            }`}
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              actionAlert.type === 'success'
                ? 'bg-emerald-50 text-emerald-700'
                : actionAlert.type === 'warning'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-rose-50 text-rose-700'
            }`}>
              {actionAlert.type === 'success'
                ? <CheckCircle2 className="h-5 w-5" />
                : actionAlert.type === 'warning'
                  ? <AlertTriangle className="h-5 w-5" />
                  : <AlertCircle className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-[#17211d]">{actionAlert.title}</p>
              <p className="mt-1 text-xs leading-5 text-[#64748b]">{actionAlert.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setActionAlert(null)}
              aria-label="Dismiss alert"
              className="rounded-lg p-1.5 text-[#64748b] transition hover:bg-[#f1f5f3] hover:text-[#17211d]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <div className="space-y-6">
        
        {/* Header Title */}
        <div className="flex flex-col justify-between gap-5 border-b border-[#dfe6e2] pb-6 md:flex-row md:items-end">
          <div>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf7f1] text-[#16835f]">
              <ViewIcon className="h-5 w-5" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#17211d]">
              {viewConfig.title}
            </h1>
            <p className="mt-1.5 text-sm text-[#66756e]">
              {viewConfig.subtitle}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            {accountingRealtimeStatus !== 'connected' && (
              <span className="inline-flex h-10 items-center gap-2 self-start rounded-full border border-[#d8e1dd] bg-white px-3 text-[10px] font-extrabold uppercase tracking-wider text-[#66756e] sm:self-end">
                <span className={`h-2 w-2 rounded-full ${accountingRealtimeStatus === 'error' ? 'bg-rose-500' : 'bg-amber-400'}`} />
                {accountingRealtimeStatus === 'error' ? 'Sync error' : 'Connecting'}
              </span>
            )}
            <label className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#66756e]">
              <span className="mb-1.5 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-[#16835f]" />
                Village Community
              </span>
              <select
                value={selectedVillageId}
                onChange={(event) => {
                  setSelectedVillageId(event.target.value);
                  setStatusFilter('');
                  setMethodFilter('');
                  setCustomerFilter('');
                  setPropertyFilter('');
                }}
                disabled={villages.length === 0}
                className="min-w-64 rounded-xl border border-[#d8e1dd] bg-white px-3 py-2.5 text-xs font-bold normal-case tracking-normal text-[#26352e] shadow-sm outline-none transition focus:border-[#79bda5] focus:ring-4 focus:ring-[#dff3eb] disabled:opacity-50"
              >
                {villages.length === 0 ? (
                  <option value="">No assigned villages</option>
                ) : villages.map((village) => (
                  <option key={village.id} value={village.id}>{village.name}</option>
                ))}
              </select>
            </label>
            {view === 'receipts' && (
              <button
                onClick={handleExportCSV}
                disabled={!selectedVillageId || loading}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-200 shadow transition hover:border-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Export Village Ledger
              </button>
            )}
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

        {view === 'dashboard' && (
        <>
        {/* Audit Metrics */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
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

          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center gap-4 shadow glass-card">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shadow-inner">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Pending Documents</span>
              <span className="text-2xl font-extrabold text-white mt-0.5">{pendingDocumentsCount}</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center gap-4 shadow glass-card">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center shadow-inner">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Overdue Accounts</span>
              <span className="text-2xl font-extrabold text-white mt-0.5">{overdueAccountsCount}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            { title: 'Customer Account Ledger', description: 'Balances, monthly dues, and overdue accounts.', href: '/accounting/ledger/customer-accounts', icon: Users },
            { title: 'Receipts Audit Ledger', description: 'Payment references, receipts, and audit actions.', href: '/accounting/ledger/receipts', icon: ReceiptText },
            { title: 'Customer Documents', description: 'Review required documents before payment approval.', href: '/accounting/ledger/customer-documents', icon: FileCheck }
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.href} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow glass-card">
                <Icon className="h-6 w-6 text-emerald-400" />
                <h2 className="mt-4 text-base font-extrabold text-white">{card.title}</h2>
                <p className="mt-1 min-h-10 text-xs leading-5 text-slate-500">{card.description}</p>
                <Link href={card.href} className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-xs font-extrabold text-white transition hover:bg-emerald-500">
                  Open Ledger
                </Link>
              </div>
            );
          })}
        </div>
        </>
        )}

        {view === 'receipts' && (
        <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-4 flex flex-wrap gap-3 items-center glass-card">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold select-none">
            <Filter className="w-4 h-4 text-emerald-400" />
            <span>Receipt Filters:</span>
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
          <input value={referenceFilter} onChange={(event) => setReferenceFilter(event.target.value)} placeholder="Reference ID" className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-300 outline-none" />
          <input value={receiptFilter} onChange={(event) => setReceiptFilter(event.target.value)} placeholder="Receipt number" className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-300 outline-none" />
          <input type="date" value={receiptDateFrom} onChange={(event) => setReceiptDateFrom(event.target.value)} className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-300 outline-none" />
          <input type="date" value={receiptDateTo} onChange={(event) => setReceiptDateTo(event.target.value)} className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-300 outline-none" />
        </div>
        )}

        {view === 'documents' && (
        <>
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-850 bg-slate-900/40 p-4 glass-card">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <Filter className="h-4 w-4 text-emerald-400" />
            Document Filters:
          </div>
          <select value={documentStatusFilter} onChange={(event) => setDocumentStatusFilter(event.target.value)} className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-300 outline-none">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)} className="min-w-52 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-300 outline-none">
            <option value="">All customers</option>
            {customerOptions.map((customer) => <option key={customer.key} value={customer.key}>{customer.name}</option>)}
          </select>
          <select value={documentTypeFilter} onChange={(event) => setDocumentTypeFilter(event.target.value)} className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-300 outline-none">
            <option value="">All document types</option>
            {documentTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <select value={propertyFilter} onChange={(event) => setPropertyFilter(event.target.value)} className="min-w-52 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-300 outline-none">
            <option value="">All properties</option>
            {propertyOptions.map((property) => <option key={property.id} value={property.id}>{property.label}</option>)}
          </select>
          <input type="date" value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-300 outline-none" />
          <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-400">
            <input type="checkbox" checked={pendingDocumentsOnly} onChange={(event) => setPendingDocumentsOnly(event.target.checked)} className="accent-emerald-500" />
            Pending only
          </label>
        </div>

        {/* Customer Documents Review */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 glass-card space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <FileCheck className="w-4.5 h-4.5 text-emerald-400" />
                Customer Documents
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Open and inspect each uploaded file before approving or rejecting it.
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
                        <span className="font-bold text-emerald-400">{document.document_type}</span>
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
                        <button
                          type="button"
                          onClick={() => openDocumentReview(document)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#cfdcd6] bg-white px-3 py-1.5 text-[10px] font-extrabold text-[#176b50] transition hover:border-emerald-300 hover:bg-emerald-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {document.status === 'pending' ? 'Review Document' : 'View Review'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </>
        )}

        {view === 'receipts' && (
        /* Audit Ledger Table */
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
                  <th className="py-3 px-2">Receipt Number</th>
                  <th className="py-3 px-2 text-right">Audit Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {filteredPayments.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-xs font-semibold text-slate-500">
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
                      <td className="py-3.5 px-2 font-mono text-slate-500">{p.official_receipt_number || 'Not issued'}</td>
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
        )}

        {view === 'accounts' && (
        <>
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#e1e7e4] bg-white p-4 shadow-[0_1px_2px_rgba(20,40,31,0.03)]">
          <div className="mr-1 flex items-center gap-2 text-xs font-bold text-[#52635b]">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef7f3] text-[#16835f]">
              <Filter className="h-4 w-4" />
            </span>
            Filters
          </div>
          <select value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)} className="min-w-52 rounded-xl border border-[#d8e1dd] bg-[#fbfcfb] px-3 py-2.5 text-xs font-medium text-[#34443d] outline-none transition focus:border-[#79bda5] focus:ring-4 focus:ring-[#e5f5ef]">
            <option value="">All customers</option>
            {customerOptions.map((customer) => <option key={customer.key} value={customer.key}>{customer.name}</option>)}
          </select>
          <select value={propertyFilter} onChange={(event) => setPropertyFilter(event.target.value)} className="min-w-52 rounded-xl border border-[#d8e1dd] bg-[#fbfcfb] px-3 py-2.5 text-xs font-medium text-[#34443d] outline-none transition focus:border-[#79bda5] focus:ring-4 focus:ring-[#e5f5ef]">
            <option value="">All village properties</option>
            {propertyOptions.map((property) => <option key={property.id} value={property.id}>{property.label}</option>)}
          </select>
          <select value={accountStatusFilter} onChange={(event) => setAccountStatusFilter(event.target.value)} className="rounded-xl border border-[#d8e1dd] bg-[#fbfcfb] px-3 py-2.5 text-xs font-medium text-[#34443d] outline-none transition focus:border-[#79bda5] focus:ring-4 focus:ring-[#e5f5ef]">
            <option value="">All payment statuses</option>
            <option value="current">Current</option>
            <option value="due_soon">Due soon</option>
            <option value="overdue">Overdue</option>
            <option value="fully_paid">Fully paid</option>
            <option value="no_due">No due</option>
          </select>
          <label className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#d8e1dd] bg-[#fbfcfb] px-3 text-xs font-bold text-[#52635b]">
            <input type="checkbox" checked={overdueOnly} onChange={(event) => setOverdueOnly(event.target.checked)} className="accent-emerald-500" />
            Overdue only
          </label>
          <input type="date" value={accountDateFrom} onChange={(event) => setAccountDateFrom(event.target.value)} className="rounded-xl border border-[#d8e1dd] bg-[#fbfcfb] px-3 py-2.5 text-xs text-[#52635b] outline-none transition focus:border-[#79bda5] focus:ring-4 focus:ring-[#e5f5ef]" />
          <input type="date" value={accountDateTo} onChange={(event) => setAccountDateTo(event.target.value)} className="rounded-xl border border-[#d8e1dd] bg-[#fbfcfb] px-3 py-2.5 text-xs text-[#52635b] outline-none transition focus:border-[#79bda5] focus:ring-4 focus:ring-[#e5f5ef]" />
          <select value={accountSort} onChange={(event) => setAccountSort(event.target.value)} className="rounded-xl border border-[#d8e1dd] bg-[#fbfcfb] px-3 py-2.5 text-xs font-medium text-[#34443d] outline-none transition focus:border-[#79bda5] focus:ring-4 focus:ring-[#e5f5ef]">
            <option value="next_due">Sort by next due</option>
            <option value="balance_desc">Balance: high to low</option>
            <option value="balance_asc">Balance: low to high</option>
          </select>
        </div>

        {/* Customer Account Ledger */}
        <div className="space-y-5 rounded-2xl border border-[#e1e7e4] bg-white p-6 shadow-[0_8px_28px_rgba(26,52,40,0.045)]">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#223129]">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef7f3] text-[#16835f]">
                  <CalendarClock className="h-4 w-4" />
                </span>
                Customer Account Ledger
              </h3>
              <p className="mt-2 text-xs text-[#718078]">
                View customer balances, monthly dues, upcoming payments, and overdue accounts.
              </p>
            </div>
            <span className="rounded-full border border-[#d8e1dd] bg-[#f7f9f8] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[#52635b]">
              {filteredAccountPlans.length} accounts
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-left text-xs font-medium">
              <thead>
                <tr className="select-none border-y border-[#e5ebe8] bg-[#f8faf9] text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#718078]">
                  <th className="px-3 py-3.5">Customer</th>
                  <th className="py-3 px-2">Property</th>
                  <th className="py-3 px-2">Payable Balance</th>
                  <th className="py-3 px-2">Monthly Payment</th>
                  <th className="py-3 px-2">Next Due</th>
                  <th className="py-3 px-2">Overdue</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8edeb] text-[#34443d]">
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
                  const canRecordPayment = plan.payment_type === 'full_payment'
                    ? Number(plan.remaining_balance || 0) > 0
                    : Boolean(status.nextDue && monthlyPayment > 0);

                  return (
                    <tr key={plan.id} className="transition-colors hover:bg-[#fafcfb]">
                      <td className="px-3 py-4">
                        <span className="block font-extrabold text-[#223129]">{customer.full_name || reservation.guest_name || 'Guest Buyer'}</span>
                        <span className="mt-0.5 block text-[10px] text-[#7c8983]">{customer.email || reservation.guest_email || 'No email'}</span>
                      </td>
                      <td className="py-3.5 px-2">
                        <span className="block font-bold text-[#34443d]">{property.property_code || reservation.reservation_code}</span>
                        <span className="mt-0.5 block text-[10px] text-[#7c8983]">{property.villages?.name || 'Village'} B{property.block_number || '-'} L{property.lot_number || '-'}</span>
                      </td>
                      <td className="py-3.5 px-2 font-extrabold text-[#223129]">{formatPeso(plan.remaining_balance)}</td>
                      <td className="py-3.5 px-2">
                        {monthlyPayment > 0 ? (
                          <span>
                            <span className="block font-bold text-[#34443d]">{formatPeso(monthlyPayment)}</span>
                            <span className="text-[10px] text-[#7c8983]">for {getLedgerTermMonths(plan)} months</span>
                          </span>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="py-3.5 px-2">
                        <span className="block">
                          {plan.payment_type === 'full_payment' && Number(plan.remaining_balance || 0) > 0
                            ? 'Full balance due'
                            : status.nextDue
                              ? formatDate(status.nextDue.due_date)
                              : 'No due scheduled'}
                        </span>
                        {status.nextDue && <span className="block text-[10px] text-[#7c8983]">{formatPeso(nextDueAmount)}</span>}
                        {plan.payment_type === 'full_payment' && Number(plan.remaining_balance || 0) > 0 && (
                          <span className="block text-[10px] text-[#7c8983]">{formatPeso(plan.remaining_balance)}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-2">
                        {status.overdueRows.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-red-500 font-bold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {status.overdueRows.length} due / {formatPeso(overdueAmount)}
                          </span>
                        ) : (
                          <span className="text-[#7c8983]">None</span>
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
                          disabled={!canRecordPayment}
                          onClick={() => openCashPayment(plan)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#d5ded9] bg-white px-3 text-[10px] font-extrabold text-[#405149] shadow-sm transition hover:border-[#aebdb6] hover:bg-[#f8faf9] disabled:cursor-not-allowed disabled:bg-[#f1f4f2] disabled:text-[#a5afa9] disabled:shadow-none"
                        >
                          <Coins className="w-3.5 h-3.5" />
                          {plan.payment_type === 'full_payment' ? 'Record Balance' : 'Record Cash'}
                        </button>
                        <button
                          type="button"
                          disabled={!plan.customer_id || !status.canNotify || notifyingPlanId === plan.id}
                          onClick={() => handleNotifyCustomer(plan)}
                          title={!plan.customer_id ? 'Guest reservations are not linked to a customer notification inbox.' : undefined}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#b7dfcf] bg-[#eef8f4] px-3 text-[10px] font-extrabold text-[#13795b] transition hover:border-[#8dcbb5] hover:bg-[#e3f4ed] disabled:cursor-not-allowed disabled:border-[#dce4e0] disabled:bg-[#f1f4f2] disabled:text-[#a5afa9]"
                        >
                          <BellRing className="w-3.5 h-3.5" />
                          {notifyingPlanId === plan.id ? 'Sending...' : 'Notify'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatementPlan(plan)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#d5ded9] bg-[#f8faf9] px-3 text-[10px] font-extrabold text-[#405149] transition hover:border-[#aebdb6] hover:bg-[#f1f5f3]"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          View Statement
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
        </>
        )}

        {view === 'accounts' && cashPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17211d]/55 p-4 backdrop-blur-sm">
            <form
              onSubmit={handleRecordCashPayment}
              className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)]"
            >
              <div className="flex items-start justify-between gap-4 border-b border-[#e2e8f0] bg-[#f8faf9] px-6 py-5">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-700">Accounting Cash Payment</p>
                  <h3 className="mt-1 text-xl font-extrabold text-[#17211d]">
                    {cashPlan.plan.reservations?.profiles?.full_name || cashPlan.plan.reservations?.guest_name || 'Customer Account'}
                  </h3>
                  <p className="mt-1 text-xs text-[#64748b]">Record an office payment and issue an official receipt.</p>
                </div>
                <button
                  type="button"
                  onClick={closeCashPayment}
                  disabled={recordingCash}
                  aria-label="Close cash payment dialog"
                  className="rounded-xl border border-[#dbe4ee] bg-white p-2 text-[#64748b] transition hover:bg-[#eef5f1] hover:text-[#17211d] disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-5 p-6">
                <div className="grid grid-cols-2 gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-xs">
                  <div>
                    <p className="font-extrabold uppercase tracking-wider text-emerald-800">Property</p>
                    <p className="mt-1.5 font-extrabold text-[#17211d]">{cashPlan.plan.reservations?.properties?.property_code || cashPlan.plan.reservations?.reservation_code}</p>
                  </div>
                  <div>
                    <p className="font-extrabold uppercase tracking-wider text-emerald-800">
                      {cashPlan.plan.payment_type === 'full_payment' ? 'Payment Type' : 'Next Due'}
                    </p>
                    <p className="mt-1.5 font-extrabold text-[#17211d]">
                      {cashPlan.plan.payment_type === 'full_payment'
                        ? 'Remaining Full Balance'
                        : formatDate(cashPlan.status.nextDue?.due_date)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-[#475569]">Cash Amount</label>
                    <div className="flex overflow-hidden rounded-xl border border-[#cbd5e1] bg-white focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/10">
                      <span className="flex items-center border-r border-[#e2e8f0] bg-[#f8fafc] px-3 text-sm font-extrabold text-[#475569]">PHP</span>
                      <input
                        type="number"
                        required
                        min="1"
                        step="0.01"
                        value={cashAmount}
                        onChange={(event) => setCashAmount(event.target.value)}
                        className="min-w-0 flex-1 bg-white px-3 py-3 text-sm font-extrabold text-[#17211d] outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-[#475569]">OR / Receipt No.</label>
                    <input
                      type="text"
                      value={cashReceipt}
                      onChange={(event) => setCashReceipt(event.target.value)}
                      placeholder="Auto if blank"
                      className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3 py-3 text-sm font-semibold text-[#17211d] outline-none transition placeholder:text-[#94a3b8] focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-[#475569]">Accounting Notes</label>
                  <textarea
                    rows={3}
                    value={cashNotes}
                    onChange={(event) => setCashNotes(event.target.value)}
                    placeholder="Cash received at office, collector name, or other audit notes."
                    className="w-full resize-none rounded-xl border border-[#cbd5e1] bg-white px-3 py-3 text-sm text-[#17211d] outline-none transition placeholder:text-[#94a3b8] focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-[#e2e8f0] bg-[#f8faf9] p-5">
                <button
                  type="button"
                  onClick={closeCashPayment}
                  className="min-h-11 rounded-xl border border-[#cbd5e1] bg-white px-4 text-xs font-extrabold text-[#334155] transition hover:border-[#94a3b8] hover:bg-[#f1f5f9]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordingCash}
                  className="min-h-11 rounded-xl bg-emerald-700 px-4 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {recordingCash ? 'Recording...' : 'Record Cash Payment'}
                </button>
              </div>
            </form>
          </div>
        )}

        {view === 'accounts' && statementPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm">
            <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-800 bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">Statement of Account</p>
                  <h3 className="mt-1 text-lg font-extrabold text-slate-900">
                    {statementPlan.reservations?.profiles?.full_name || statementPlan.reservations?.guest_name || 'Customer Account'}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {statementPlan.reservations?.properties?.property_code || statementPlan.reservations?.reservation_code}
                  </p>
                </div>
                <button type="button" onClick={() => setStatementPlan(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
                  Close
                </button>
              </div>
              <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-5 text-sm sm:grid-cols-3">
                <div><p className="text-xs text-slate-500">Contract Price</p><p className="font-extrabold text-slate-900">{formatPeso(statementPlan.total_contract_price)}</p></div>
                <div><p className="text-xs text-slate-500">Amount Paid</p><p className="font-extrabold text-slate-900">{formatPeso(statementPlan.amount_paid)}</p></div>
                <div><p className="text-xs text-slate-500">Payable Balance</p><p className="font-extrabold text-slate-900">{formatPeso(statementPlan.remaining_balance)}</p></div>
              </div>
              <div className="max-h-[55vh] overflow-auto p-5">
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-2">Payment No.</th><th>Due Date</th><th>Amount Due</th><th>Amount Paid</th><th>Remaining</th><th>Status</th></tr></thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {getPlanSchedule(statementPlan).map((row) => (
                      <tr key={row.id || row.due_number}>
                        <td className="py-3">{row.due_number}</td>
                        <td>{formatDate(row.due_date)}</td>
                        <td>{formatPeso(row.amount_due)}</td>
                        <td>{formatPeso(row.amount_paid)}</td>
                        <td>{formatPeso(row.remaining_due)}</td>
                        <td className="font-bold uppercase">{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end border-t border-slate-200 bg-slate-50 p-4">
                <button type="button" onClick={() => window.print()} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-emerald-500">
                  Print Statement
                </button>
              </div>
            </div>
        </div>
        )}

        {view === 'documents' && selectedDocument && (
          <div className="fixed inset-0 z-[130] bg-[#17211d]/35 backdrop-blur-[2px]">
            <button
              type="button"
              aria-label="Close document review"
              onClick={closeDocumentReview}
              className="absolute inset-0 h-full w-full cursor-default"
            />
            <aside className="absolute inset-y-0 right-0 z-10 flex w-full flex-col bg-[#f7faf8] shadow-2xl sm:max-w-2xl">
              <header className="flex items-start justify-between border-b border-[#dfe6e2] bg-white px-5 py-4 sm:px-6">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-700">
                    Accounting Document Review
                  </p>
                  <h2 className="mt-1 text-xl font-extrabold text-[#17211d]">
                    {selectedDocument.document_type}
                  </h2>
                  <p className="mt-1 text-xs text-[#66756e]">
                    Inspect the uploaded file before making a decision.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDocumentReview}
                  disabled={Boolean(reviewingDocumentId)}
                  className="rounded-xl border border-[#d7e1dc] bg-white p-2 text-[#52635b] transition hover:bg-[#f1f6f3] disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
                {(() => {
                  const reservation = selectedDocument.reservations || {};
                  const property = reservation.properties || {};
                  const customerName = reservation.profiles?.full_name || reservation.guest_name || 'Guest Buyer';
                  const customerEmail = reservation.profiles?.email || reservation.guest_email || 'No email provided';

                  return (
                    <>
                      <section className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-[#dfe6e2] bg-white p-4">
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#75847d]">Customer</p>
                          <p className="mt-1 text-sm font-extrabold text-[#17211d]">{customerName}</p>
                          <p className="mt-1 text-xs text-[#66756e]">{customerEmail}</p>
                        </div>
                        <div className="rounded-xl border border-[#dfe6e2] bg-white p-4">
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#75847d]">Property</p>
                          <p className="mt-1 text-sm font-extrabold text-[#17211d]">{property.villages?.name || 'Village'}</p>
                          <p className="mt-1 text-xs text-[#66756e]">Block {property.block_number || '-'}, Lot {property.lot_number || '-'}</p>
                        </div>
                      </section>

                      <section className="overflow-hidden rounded-2xl border border-[#d7e1dc] bg-white shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e3eae6] px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                              <FileText className="h-4 w-4" />
                            </span>
                            <div>
                              <p className="text-sm font-extrabold text-[#17211d]">Uploaded document</p>
                              <p className="text-[11px] text-[#66756e]">
                                Uploaded {formatDate(selectedDocument.uploaded_at)}
                              </p>
                            </div>
                          </div>
                          <a
                            href={selectedDocument.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#cfdcd6] bg-white px-3 py-2 text-xs font-extrabold text-[#176b50] transition hover:bg-emerald-50"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open Original
                          </a>
                        </div>
                        <div className="h-[48vh] min-h-80 bg-[#eef3f0] p-3">
                          <object
                            data={selectedDocument.file_url}
                            className="h-full w-full rounded-xl bg-white"
                            aria-label={`${selectedDocument.document_type} preview`}
                          >
                            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                              <FileText className="h-10 w-10 text-[#8aa097]" />
                              <p className="text-sm font-bold text-[#52635b]">Preview is not available for this file.</p>
                              <a href={selectedDocument.file_url} target="_blank" rel="noreferrer" className="text-xs font-extrabold text-emerald-700">
                                Open the original document
                              </a>
                            </div>
                          </object>
                        </div>
                      </section>

                      <section className="rounded-xl border border-[#dfe6e2] bg-white p-4">
                        <p className="text-xs font-extrabold uppercase tracking-wider text-[#52635b]">Review checklist</p>
                        <div className="mt-3 grid gap-2 text-xs text-[#52635b] sm:grid-cols-3">
                          <span className="rounded-lg bg-[#f2f7f4] px-3 py-2">File is clear and readable</span>
                          <span className="rounded-lg bg-[#f2f7f4] px-3 py-2">Details match the customer</span>
                          <span className="rounded-lg bg-[#f2f7f4] px-3 py-2">Document appears complete</span>
                        </div>
                      </section>

                      {selectedDocument.status !== 'pending' && (
                        <section className={`rounded-xl border p-4 ${
                          selectedDocument.status === 'approved'
                            ? 'border-emerald-200 bg-emerald-50'
                            : 'border-rose-200 bg-rose-50'
                        }`}>
                          <p className="text-xs font-extrabold uppercase tracking-wider text-[#52635b]">
                            Review result: {selectedDocument.status}
                          </p>
                          <p className="mt-1 text-xs text-[#66756e]">
                            Reviewed {selectedDocument.reviewed_at ? formatDate(selectedDocument.reviewed_at) : 'previously'}
                          </p>
                          {selectedDocument.rejection_reason && (
                            <p className="mt-3 rounded-lg bg-white/80 p-3 text-sm font-semibold text-rose-700">
                              {selectedDocument.rejection_reason}
                            </p>
                          )}
                        </section>
                      )}

                      {selectedDocument.status === 'pending' && documentReviewDecision === 'rejected' && (
                        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                          <label className="text-xs font-extrabold uppercase tracking-wider text-rose-800">
                            Reason for rejection
                          </label>
                          <textarea
                            rows={4}
                            value={documentRejectionReason}
                            onChange={(event) => setDocumentRejectionReason(event.target.value)}
                            placeholder="Explain what is invalid, unclear, expired, or missing."
                            className="mt-2 w-full resize-none rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-sm text-[#17211d] outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
                          />
                          <p className="mt-2 text-xs text-rose-700">This reason will be shown to the customer.</p>
                        </section>
                      )}
                    </>
                  );
                })()}
              </div>

              <footer className="border-t border-[#dfe6e2] bg-white p-4 sm:px-6">
                {selectedDocument.status === 'pending' ? (
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={closeDocumentReview}
                      disabled={Boolean(reviewingDocumentId)}
                      className="rounded-xl border border-[#d7e1dc] bg-white px-4 py-2.5 text-xs font-extrabold text-[#52635b] transition hover:bg-[#f1f6f3] disabled:opacity-50"
                    >
                      Close
                    </button>
                    {documentReviewDecision === 'rejected' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setDocumentReviewDecision('');
                            setDocumentRejectionReason('');
                          }}
                          disabled={Boolean(reviewingDocumentId)}
                          className="rounded-xl border border-[#d7e1dc] bg-white px-4 py-2.5 text-xs font-extrabold text-[#52635b] disabled:opacity-50"
                        >
                          Cancel Rejection
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReviewDocument('rejected')}
                          disabled={Boolean(reviewingDocumentId)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-rose-500 disabled:opacity-50"
                        >
                          {reviewingDocumentId ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                          Confirm Rejection
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setDocumentReviewDecision('rejected')}
                          disabled={Boolean(reviewingDocumentId)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-extrabold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                        >
                          <X className="h-4 w-4" />
                          Reject Document
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReviewDocument('approved')}
                          disabled={Boolean(reviewingDocumentId)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-extrabold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {reviewingDocumentId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          Approve Document
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={closeDocumentReview}
                      className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-extrabold text-white transition hover:bg-emerald-500"
                    >
                      Done
                    </button>
                  </div>
                )}
              </footer>
            </aside>
          </div>
        )}

        {/* Interactive Audit Verification Modal */}
        {view === 'receipts' && selectedPayment && (
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
