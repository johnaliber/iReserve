'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import CustomerShell from '@/components/customer/CustomerShell';
import { 
  Building, 
  Coins, 
  FileCheck, 
  Calendar, 
  AlertCircle, 
  Compass, 
  Layers, 
  ArrowRight,
  BellRing,
  Inbox,
  QrCode,
  X,
  TableProperties
} from 'lucide-react';
import Link from 'next/link';
import PaymentSummaryCard from '@/components/payments/PaymentSummaryCard';
import PaymentScheduleTable from '@/components/payments/PaymentScheduleTable';
import PaymentQr, { makePaymentCode } from '@/components/payments/PaymentQr';
import { formatPeso } from '@/lib/payments/paymentMath';
import { addCalendarMonths, dateOnly, normalizeMonthlyScheduleRows } from '@/lib/payments/scheduleDates';
import ConfirmActionDialog from '@/components/shared/ConfirmActionDialog';
import DelayedLoadingState from '@/components/shared/DelayedLoadingState';
import EmptyState from '@/components/shared/EmptyState';
import CustomerDashboardCard from '@/components/customer/CustomerDashboardCard';
import NextStepCard from '@/components/customer/NextStepCard';
import FriendlyStatusBadge from '@/components/customer/FriendlyStatusBadge';
import { useRealtimeReservation } from '@/lib/realtime/useRealtimeReservation';
import { useRealtimePayments } from '@/lib/realtime/useRealtimePayments';
import { useRealtimeTable } from '@/lib/realtime/useRealtimeTable';
import { useRealtimeRefresh } from '@/lib/realtime/useRealtimeRefresh';

function getPlanTerm(plan) {
  if (plan?.payment_type === 'full_payment') return 0;
  return Math.max(1, Number(plan?.installment_term_months || 6));
}

function getPlanMonthlyPayment(plan) {
  if (plan?.payment_type === 'full_payment') return 0;
  if (Number(plan?.monthly_payment || 0) > 0) return Number(plan.monthly_payment);
  const remaining = Number(plan?.remaining_balance || 0);
  return remaining > 0 ? remaining / getPlanTerm(plan) : 0;
}

function getCustomerSchedule(plan, reservation) {
  const rows = normalizeMonthlyScheduleRows(Array.isArray(plan?.payment_schedule) ? plan.payment_schedule : []);
  if (plan?.payment_type === 'full_payment') return [];
  const hasOpenDue = rows.some((row) => ['unpaid', 'partially_paid', 'overdue'].includes(row.status));
  if (hasOpenDue || Number(plan?.remaining_balance || 0) <= 0) return rows;

  const latestRow = [...rows].sort((a, b) => new Date(b.due_date) - new Date(a.due_date))[0];
  const dueDate = latestRow?.due_date
    ? dateOnly(addCalendarMonths(latestRow.due_date, 1))
    : plan?.next_due_date || dateOnly(addCalendarMonths(reservation?.approved_at || reservation?.reserved_at || plan?.start_date || plan?.created_at, 1));
  const amount = getPlanMonthlyPayment(plan);
  if (amount <= 0) return rows;

  return [...rows, {
    id: `fallback-${plan.id}`,
    payment_plan_id: plan.id,
    due_number: rows.length + 1,
    due_date: dueDate,
    amount_due: amount,
    amount_paid: 0,
    remaining_due: amount,
    status: 'unpaid',
    isFallback: true
  }];
}

export default function CustomerDashboardPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [payments, setPayments] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [siteViewings, setSiteViewings] = useState([]);
  const [selectedDue, setSelectedDue] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('gcash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentStarted, setPaymentStarted] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [confirmPayment, setConfirmPayment] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);

  const fetchDashboardData = useCallback(async ({
    claimReservations = true
  } = {}) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      setUser(authUser);

      if (claimReservations) {
        const claimResponse = await fetch('/api/customer/claim-reservations', {
          method: 'POST'
        });
        if (!claimResponse.ok) {
          console.error('Guest reservations could not be linked to this customer account.');
        }
      }

      // 1. Fetch Reservations
      const { data: res } = await supabase
        .from('reservations')
        .select('*, properties(*, villages(*)), payment_plans(*, payment_schedule(*))')
        .eq('customer_id', authUser.id)
        .order('created_at', { ascending: false });

      setReservations(res || []);

      // 2. Fetch Payments
      const { data: pay } = await supabase
        .from('payments')
        .select('*')
        .eq('customer_id', authUser.id)
        .order('created_at', { ascending: false });

      setPayments(pay || []);

      // 3. Fetch Documents
      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .eq('customer_id', authUser.id);

      setDocuments(docs || []);

      // 4. Fetch Site Viewings
      const { data: viewings } = await supabase
        .from('site_viewings')
        .select('*, properties(*)')
        .eq('customer_id', authUser.id);

      setSiteViewings(viewings || []);

    } catch (err) {
      console.error('Error fetching customer dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchDashboardData();
    });
  }, [fetchDashboardData]);
  const refreshDashboardSilently = useCallback(() => {
    fetchDashboardData({ claimReservations: false });
  }, [fetchDashboardData]);
  const scheduleDashboardRefresh = useRealtimeRefresh(refreshDashboardSilently, 300);
  const reservationRealtimeStatus = useRealtimeReservation({
    customerId: user?.id,
    onReservationChange: scheduleDashboardRefresh
  });
  useRealtimePayments({
    customerId: user?.id,
    onPaymentChange: scheduleDashboardRefresh
  });
  useRealtimeTable({
    table: 'payment_plans',
    filter: user?.id ? `customer_id=eq.${user.id}` : undefined,
    onChange: scheduleDashboardRefresh,
    enabled: Boolean(user?.id)
  });
  useRealtimeTable({
    table: 'payment_schedule',
    onChange: scheduleDashboardRefresh,
    enabled: Boolean(user?.id)
  });
  useRealtimeTable({
    table: 'documents',
    filter: user?.id ? `customer_id=eq.${user.id}` : undefined,
    onChange: scheduleDashboardRefresh,
    enabled: Boolean(user?.id)
  });
  useRealtimeTable({
    table: 'site_viewings',
    filter: user?.id ? `customer_id=eq.${user.id}` : undefined,
    onChange: scheduleDashboardRefresh,
    enabled: Boolean(user?.id)
  });

  const openNextPayment = (row, plan, reservation) => {
    setSelectedDue({ row, plan, reservation });
    setPaymentMethod('gcash');
    setReferenceNumber('');
    setPaymentStarted(false);
  };

  const closeNextPayment = () => {
    if (submittingPayment) return;
    setSelectedDue(null);
    setReferenceNumber('');
    setPaymentStarted(false);
  };

  const handleSubmitNextPayment = async () => {
    if (!selectedDue) return;
    if (!paymentStarted) {
      alert('Please click Pay Now and scan the generated QR before submitting.');
      return;
    }

    setSubmittingPayment(true);
    try {
      const response = await fetch('/api/customer/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentPlanId: selectedDue.plan.id,
          paymentScheduleId: selectedDue.row.isFallback || selectedDue.row.isFullBalance
            ? null
            : selectedDue.row.id,
          amount: Number(selectedDue.row.remaining_due || selectedDue.row.amount_due || 0),
          paymentMethod,
          referenceNumber
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Payment could not be submitted.');

      alert('Payment submitted. Accounting will verify it shortly.');
      setConfirmPayment(false);
      closeNextPayment();
      await fetchDashboardData({ claimReservations: false });
    } catch (err) {
      alert(err.message || 'Payment could not be submitted.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  if (loading) {
    return (
      <CustomerShell><DelayedLoadingState loading message="Preparing your account overview..." /></CustomerShell>
    );
  }

  const activeReservation = reservations[0];
  const activePlan = Array.isArray(activeReservation?.payment_plans)
    ? activeReservation.payment_plans[0]
    : activeReservation?.payment_plans;
  const pendingDocuments = documents.filter((document) => document.status !== 'approved').length;
  const nextStep = !activeReservation
    ? { title: 'Choose a village and lot', description: 'Browse available communities and click a green lot to begin.', action: 'Browse Villages', href: '/villages' }
    : activeReservation.status === 'pending_payment'
      ? { title: 'Upload your payment receipt', description: 'Submit a clear receipt so Accounting can review your payment.', action: 'Go to Payments', href: '/customer/payments' }
      : pendingDocuments > 0
        ? { title: 'Complete your documents', description: `${pendingDocuments} document${pendingDocuments === 1 ? '' : 's'} still need attention.`, action: 'View Documents', href: '/customer/documents' }
        : activeReservation.status === 'pending_verification'
          ? { title: 'Wait for review', description: 'Your information was submitted. We will notify you after review.', action: 'View Notifications', href: '/customer/notifications' }
          : { title: 'Your reservation is on track', description: 'Review your payment schedule and upcoming site viewing details.', action: 'View Reservation', href: '/customer/reservations' };

  return (
    <CustomerShell>
      <div className="space-y-6">
        
        <div className="rounded-3xl border border-[#e2e8f0] bg-gradient-to-r from-white to-emerald-50 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#17211d]">
              Welcome back
            </h1>
            <p className="mt-1 text-sm font-medium leading-5 text-[#475b52]">
              Here is a simple overview of your reservation and what to do next.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            {reservationRealtimeStatus !== 'connected' && (
              <span className="inline-flex items-center gap-2 rounded-full border border-[#dbe4ee] bg-white px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">
                <span className={`h-2 w-2 rounded-full ${reservationRealtimeStatus === 'error' ? 'bg-rose-500' : 'bg-amber-400'}`} />
                {reservationRealtimeStatus === 'error' ? 'Sync error' : 'Connecting'}
              </span>
            )}
            <Link
              href="/villages"
              className="flex items-center gap-1 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 shadow transition hover:bg-emerald-400"
            >
              Browse Villages
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <CustomerDashboardCard icon={Building} label="Active Reservation" value={activeReservation ? '1' : 'None'} helper={activeReservation ? `Block ${activeReservation.properties?.block_number || '-'}, Lot ${activeReservation.properties?.lot_number || '-'}` : 'Choose a lot to get started.'} />
          <CustomerDashboardCard icon={Coins} label="Payment Status" value={activePlan ? `${Math.round(Number(activePlan.total_payment_progress || 0))}%` : 'Not started'} helper={activePlan ? `${formatPeso(activePlan.remaining_balance)} remaining` : 'No payment plan yet.'} tone={activePlan?.overdue_count > 0 ? 'rose' : 'emerald'} />
          <CustomerDashboardCard icon={FileCheck} label="Documents" value={pendingDocuments > 0 ? `${pendingDocuments} need attention` : 'Complete'} helper={`${documents.filter((item) => item.status === 'approved').length} approved`} tone={pendingDocuments > 0 ? 'amber' : 'emerald'} />
          <CustomerDashboardCard icon={Calendar} label="Site Viewing" value={siteViewings[0] ? siteViewings[0].status?.replaceAll('_', ' ') : 'Not scheduled'} helper={siteViewings[0]?.preferred_date || 'Request a date when ready.'} />
        </div>

        <NextStepCard title={nextStep.title} description={nextStep.description} actionLabel={nextStep.action} actionHref={nextStep.href} />

        {reservations.length === 0 ? (
          /* Empty State */
          <EmptyState icon={Inbox} title="No reservations yet" description="Browse a village, open its map, and select a green available lot." actionLabel="Browse Villages" actionHref="/villages" />
        ) : (
          /* Active Content Grid */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left/Center Column: Reservations & Payments List */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Active Reservations Card */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 glass-card space-y-4">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 mb-2">
                  <Inbox className="w-4.5 h-4.5 text-emerald-700" />
                  Active Land Reservations ({reservations.length})
                </h3>

                <div className="divide-y divide-slate-800/80">
                  {reservations.map((res) => {
                    const prop = res.properties || {};
                    const plan = Array.isArray(res.payment_plans) ? res.payment_plans[0] : res.payment_plans;
                    const schedule = getCustomerSchedule(plan, res);
                    const fullBalanceDue = plan?.payment_type === 'full_payment'
                      && Number(plan.remaining_balance || 0) > 0;
                    
                    return (
                      <div key={res.id} className="py-4 first:pt-0 last:pb-0 flex flex-col gap-4">
                        <PaymentSummaryCard plan={plan} />
                        {schedule.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedSchedule({
                              rows: normalizeMonthlyScheduleRows(schedule),
                              plan,
                              reservation: res
                            })}
                            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-extrabold text-emerald-700 transition hover:bg-emerald-100 sm:w-auto"
                          >
                            <TableProperties className="h-4 w-4" />
                            View Full Payment Schedule
                          </button>
                        )}
                        {fullBalanceDue && (
                          <button
                            type="button"
                            onClick={() => openNextPayment({
                              id: `full-balance-${plan.id}`,
                              amount_due: Number(plan.remaining_balance || 0),
                              remaining_due: Number(plan.remaining_balance || 0),
                              due_date: null,
                              isFullBalance: true
                            }, plan, res)}
                            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-500 sm:w-auto"
                          >
                            <Coins className="h-4 w-4" />
                            Pay Remaining Full Balance
                          </button>
                        )}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-100 text-sm">
                              Block {prop.block_number} Lot {prop.lot_number}
                            </span>
                            <FriendlyStatusBadge status={res.status} />
                          </div>
                          
                          <p className="text-xs font-semibold text-[#475b52]">
                            {prop.villages?.name} • Facing {prop.orientation} • {prop.lot_size} sqm area
                          </p>
                          
                          <div className="flex items-center gap-3 pt-1 text-xs font-medium text-[#52635b]">
                            <span className="flex items-center gap-1">
                              <Coins className="w-3.5 h-3.5 text-emerald-500/60" />
                              Deposit: ₱{res.reservation_fee?.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-emerald-500/60" />
                              Booked: {new Date(res.reserved_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent payments */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 glass-card space-y-4">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 mb-2">
                  <Coins className="w-4.5 h-4.5 text-emerald-700" />
                  Recent Payments
                </h3>

                <div className="divide-y divide-slate-800/60 text-xs">
                  {payments.length === 0 ? (
                    <span className="block py-2 text-sm font-medium text-[#475b52]">No payment logs recorded yet.</span>
                  ) : (
                    payments.map((p) => (
                      <div key={p.id} className="py-3 first:pt-0 last:pb-0 flex justify-between items-center">
                        <div>
                          <span className="font-semibold text-slate-300 block">GCASH Transaction</span>
                          <span className="mt-0.5 block text-xs font-medium text-[#52635b]">Ref: {p.reference_number || 'N/A'}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-white block">₱{p.amount?.toLocaleString()}</span>
                          <span className={`text-[11px] font-extrabold uppercase ${p.payment_status === 'verified' ? 'text-emerald-800' : 'text-amber-900'}`}>
                            {p.payment_status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Required Documents and viewings checklist */}
            <div className="space-y-6">
              
              {/* Document Checklist Panel */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative glass-card">
                <h3 className="text-sm font-bold text-slate-200 mb-4 border-b border-slate-850 pb-2 flex items-center gap-1.5 uppercase tracking-wider">
                  <FileCheck className="w-4.5 h-4.5 text-emerald-700" />
                  ID & Income checklist
                </h3>

                <div className="space-y-3.5">
                  {documents.length === 0 ? (
                    <span className="text-sm font-medium text-[#475b52]">No documents listed.</span>
                  ) : (
                    documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-900 rounded-xl">
                        <div>
                          <span className="text-xs font-bold text-slate-300 block">{doc.document_type}</span>
                          <span className="mt-0.5 block text-xs font-medium text-[#52635b]">Reviewed by the village team</span>
                        </div>
                        <span className={`rounded border px-2 py-0.5 text-[11px] font-extrabold uppercase ${
                          doc.status === 'approved' ? 'border-emerald-300 bg-emerald-100 text-emerald-800' :
                          'border-amber-300 bg-amber-100 text-amber-900'
                        }`}>
                          {doc.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Site Viewing Schedule Cards */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative glass-card">
                <h3 className="text-sm font-bold text-slate-200 mb-4 border-b border-slate-850 pb-2 flex items-center gap-1.5 uppercase tracking-wider">
                  <Calendar className="w-4.5 h-4.5 text-emerald-700" />
                  Site viewings schedule
                </h3>

                <div className="space-y-3.5">
                  {siteViewings.length === 0 ? (
                    <div className="text-sm font-medium text-[#475b52]">
                      No viewings scheduled yet.
                    </div>
                  ) : (
                    siteViewings.map((sv) => (
                      <div key={sv.id} className="p-3 bg-slate-950/60 border border-slate-900 rounded-xl space-y-1">
                        <span className="text-xs font-bold text-slate-300 block">Lot Viewing</span>
                        <span className="block text-xs font-medium text-[#475b52]">
                          Date: {sv.preferred_date} • Time: {sv.preferred_time}
                        </span>
                        <span className={`mt-1.5 block text-[11px] font-extrabold uppercase ${sv.status === 'approved' ? 'text-emerald-800' : 'text-amber-900'}`}>
                          {sv.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

          </div>
        )}

        {selectedDue && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
            <form
              onSubmit={(event) => { event.preventDefault(); setConfirmPayment(true); }}
              className="w-full max-w-3xl overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">
                    {selectedDue.row.isFullBalance ? 'Remaining Full Balance' : 'Next Monthly Payment'}
                  </p>
                  <h2 className="text-lg font-extrabold text-[#272727]">
                    {formatPeso(selectedDue.row.remaining_due || selectedDue.row.amount_due)}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeNextPayment}
                  className="rounded-full border border-[#dbe4ee] p-2 text-[#64748b] transition hover:bg-[#f8fafc]"
                  aria-label="Close payment modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-5 p-5 md:grid-cols-[1fr_220px]">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[#64748b]">Property</p>
                      <p className="mt-1 font-extrabold text-[#272727]">
                        Block {selectedDue.reservation.properties?.block_number || '-'} Lot {selectedDue.reservation.properties?.lot_number || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[#64748b]">
                        {selectedDue.row.isFullBalance ? 'Payment Type' : 'Due Date'}
                      </p>
                      <p className="mt-1 font-extrabold text-[#272727]">
                        {selectedDue.row.isFullBalance
                          ? 'Full Payment'
                          : new Date(selectedDue.row.due_date).toLocaleDateString('en-PH')}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">Payment Method</p>
                    <div className="grid grid-cols-3 gap-2">
                      {['gcash', 'maya', 'bank_transfer'].map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPaymentMethod(method)}
                          className={`rounded-xl border px-3 py-2.5 text-xs font-extrabold uppercase transition ${
                            paymentMethod === method
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                              : 'border-[#dbe4ee] bg-white text-[#272727] hover:bg-[#f8fafc]'
                          }`}
                        >
                          {method.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px]">
                    <div>
                      <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">
                        Transaction Reference
                      </label>
                      <input
                        type="text"
                        required
                        value={referenceNumber}
                        onChange={(event) => setReferenceNumber(event.target.value)}
                        placeholder="Enter payment app reference"
                        className="w-full rounded-xl border border-[#dbe4ee] bg-white px-3 py-2.5 text-sm text-[#272727] outline-none transition focus:border-emerald-500/60"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">
                        Amount
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={formatPeso(selectedDue.row.remaining_due || selectedDue.row.amount_due)}
                        className="w-full rounded-xl border border-[#dbe4ee] bg-[#f8fafc] px-3 py-2.5 text-sm font-bold text-[#272727] outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPaymentStarted(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-500"
                  >
                    <QrCode className="h-4.5 w-4.5" />
                    Pay Now and Generate QR
                  </button>
                </div>

                <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                  {paymentStarted ? (
                    <div className="space-y-3 text-center">
                      <div className="mx-auto h-40 w-40">
                        <PaymentQr
                          value={`${paymentMethod}|${selectedDue.row.id}|${selectedDue.row.remaining_due || selectedDue.row.amount_due}`}
                        />
                      </div>
                      <p className="font-mono text-xs font-extrabold text-[#272727]">
                        {makePaymentCode(`${paymentMethod}|${selectedDue.row.id}`)}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Scan to pay</p>
                    </div>
                  ) : (
                    <div className="flex h-full min-h-48 flex-col items-center justify-center text-center text-[#64748b]">
                      <QrCode className="mb-2 h-9 w-9 text-[#5f7068]" />
                      <p className="text-xs font-bold">QR appears after Pay Now.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-[#e2e8f0] bg-[#f8fafc] p-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeNextPayment}
                  className="rounded-xl border border-[#dbe4ee] bg-white px-4 py-2.5 text-xs font-bold text-[#272727] transition hover:bg-[#f8fafc]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="rounded-xl bg-[#00c389] px-5 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#00a876] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submittingPayment ? 'Submitting...' : 'Submit Payment for Verification'}
                </button>
              </div>
            </form>
          </div>
        )}

        {selectedSchedule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm md:p-6">
            <div className="flex max-h-[92vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-3xl border border-[#e2e8f0] bg-[#f8fafc] shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-[#e2e8f0] bg-white px-5 py-4">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">Payment Details</p>
                  <h2 className="mt-1 text-xl font-extrabold text-[#272727]">Full Payment Schedule</h2>
                  <p className="mt-1 text-sm text-[#64748b]">
                    Block {selectedSchedule.reservation.properties?.block_number || '-'}, Lot {selectedSchedule.reservation.properties?.lot_number || '-'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSchedule(null)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#dbe4ee] bg-white text-[#64748b] transition hover:bg-[#f8fafc]"
                  aria-label="Close payment schedule"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="overflow-y-auto p-4 md:p-6">
                <PaymentScheduleTable
                  rows={selectedSchedule.rows}
                  onPay={(row) => {
                    openNextPayment(row, selectedSchedule.plan, selectedSchedule.reservation);
                    setSelectedSchedule(null);
                  }}
                />
              </div>

              <div className="flex justify-end border-t border-[#e2e8f0] bg-white px-5 py-4">
                <button
                  type="button"
                  onClick={() => setSelectedSchedule(null)}
                  className="min-h-11 rounded-xl border border-[#dbe4ee] bg-white px-5 text-sm font-bold text-[#272727] hover:bg-[#f8fafc]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
      <ConfirmActionDialog
        open={confirmPayment}
        title="Submit Payment Receipt?"
        message="Please make sure the receipt is clear and the payment amount is correct. Your payment will be reviewed by Accounting."
        cancelLabel="Review Again"
        confirmLabel="Submit Receipt"
        busy={submittingPayment}
        onCancel={() => setConfirmPayment(false)}
        onConfirm={handleSubmitNextPayment}
      />
    </CustomerShell>
  );
}
