import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  createFallbackPaymentSchedule,
  ensureNextPaymentSchedule,
  recalculatePaymentIndicators,
  validatePaymentAmount
} from '@/lib/payments/server';
import { roundMoney } from '@/lib/payments/paymentMath';
import { canManageVillagePayments } from '@/lib/auth/canManageVillagePayments';
import { hasPermission } from '@/lib/auth/rbac';
import { logAuditEvent } from '@/lib/audit/logAuditEvent';

export const dynamic = 'force-dynamic';

function json(status, payload) {
  return Response.json(payload, { status });
}

function fallbackReceipt() {
  return `CASH-${Date.now().toString(36).toUpperCase()}`;
}

export async function POST(request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const body = await request.json();
  const {
    paymentPlanId,
    paymentScheduleId,
    amount,
    officialReceiptNumber,
    notes
  } = body || {};

  if (!paymentPlanId) return json(400, { error: 'Payment plan is required.' });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return json(401, { error: 'You must be signed in.' });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!['accounting', 'village_admin', 'super_admin'].includes(profile?.role)
    || !await hasPermission(admin, user.id, 'payments.record_manual')) {
    return json(403, { error: 'You do not have permission to record cash payments.' });
  }

  const { data: plan, error: planError } = await admin
    .from('payment_plans')
    .select('*, reservations(id, property_id, customer_id, reservation_code, properties(property_code))')
    .eq('id', paymentPlanId)
    .single();

  if (planError || !plan) return json(404, { error: 'Payment plan was not found.' });

  if (!await canManageVillagePayments(supabase, user.id, profile?.role, plan.village_id)) {
    return json(403, { error: 'You do not have payment access to this village.' });
  }

  const isFullPayment = plan.payment_type === 'full_payment';

  const { data: documents } = await admin
    .from('documents')
    .select('status')
    .eq('reservation_id', plan.reservation_id);

  if (!documents?.length || documents.some((document) => document.status !== 'approved')) {
    return json(409, { error: 'Approve the customer documents before recording this payment.' });
  }

  let schedule = null;
  if (paymentScheduleId && !isFullPayment) {
    const { data: scheduleRow, error: scheduleError } = await admin
      .from('payment_schedule')
      .select('*')
      .eq('id', paymentScheduleId)
      .eq('payment_plan_id', paymentPlanId)
      .single();

    if (scheduleError || !scheduleRow) return json(404, { error: 'Payment due was not found.' });
    schedule = scheduleRow;
  } else if (!isFullPayment) {
    const { data: openRows } = await admin
      .from('payment_schedule')
      .select('*')
      .eq('payment_plan_id', paymentPlanId)
      .in('status', ['unpaid', 'partially_paid', 'overdue'])
      .order('due_number', { ascending: true })
      .limit(1);

    schedule = openRows?.[0] || await createFallbackPaymentSchedule(admin, paymentPlanId);
  }

  if (isFullPayment && Number(plan.remaining_balance || 0) <= 0) {
    return json(400, { error: 'This account is already fully paid.' });
  }

  if (schedule && (schedule.status === 'paid' || Number(schedule.remaining_due || 0) <= 0)) {
    return json(400, { error: 'This due is already paid.' });
  }

  const paymentPurpose = isFullPayment ? 'full_payment' : 'monthly_installment';
  const { maximumPayableAmount, amount: acceptedAmount } = await validatePaymentAmount(admin, {
    paymentPlanId,
    paymentScheduleId: schedule?.id || null,
    submittedAmount: amount || (isFullPayment ? plan.remaining_balance : schedule.remaining_due),
    paymentPurpose
  });

  const receiptNumber = officialReceiptNumber || fallbackReceipt();
  const { data: payment, error: paymentError } = await admin
    .from('payments')
    .insert({
      reservation_id: plan.reservation_id,
      payment_plan_id: paymentPlanId,
      payment_schedule_id: schedule?.id || null,
      village_id: plan.village_id,
      customer_id: plan.customer_id || plan.reservations?.customer_id,
      amount: acceptedAmount,
      payment_method: 'cash',
      payment_status: 'verified',
      payment_purpose: paymentPurpose,
      reference_number: receiptNumber,
      official_receipt_number: receiptNumber,
      proof_url: 'Cash payment recorded by accounting',
      accounting_notes: notes || 'Cash payment recorded by accounting.',
      maximum_payable_amount: maximumPayableAmount,
      submitted_amount: acceptedAmount,
      accepted_amount: acceptedAmount,
      excess_amount: 0,
      is_overpayment: false,
      verified_by: user.id,
      verified_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (paymentError) return json(400, { error: paymentError.message });

  if (schedule) {
    const amountPaid = roundMoney(Number(schedule.amount_paid || 0) + Number(acceptedAmount || 0));
    const remainingDue = roundMoney(Math.max(0, Number(schedule.amount_due || 0) - amountPaid));
    const { data: updatedSchedule, error: scheduleUpdateError } = await admin
      .from('payment_schedule')
      .update({
        amount_paid: amountPaid,
        remaining_due: remainingDue,
        status: remainingDue <= 0 ? 'paid' : 'partially_paid',
        paid_at: remainingDue <= 0 ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', schedule.id)
      .select()
      .single();

    if (scheduleUpdateError) return json(400, { error: scheduleUpdateError.message });

    if (updatedSchedule?.status === 'paid') {
      await ensureNextPaymentSchedule(admin, paymentPlanId, updatedSchedule);
    }
  }
  const updatedPlan = await recalculatePaymentIndicators(admin, paymentPlanId);

  await logAuditEvent({
    admin,
    request,
    userId: user.id,
    villageId: plan.village_id,
    action: 'payment_recorded_manually',
    entityType: 'payment',
    entityId: payment.id,
    description: `Recorded a manual cash payment for ${plan.reservations?.reservation_code || plan.reservation_id}.`,
    metadata: {
      payment_plan_id: paymentPlanId,
      payment_schedule_id: schedule?.id || null,
      payment_purpose: paymentPurpose,
      receipt_number: receiptNumber
    }
  });

  const customerId = plan.customer_id || plan.reservations?.customer_id;
  if (customerId) {
    await admin.from('notifications').insert({
      user_id: customerId,
      title: 'Cash Payment Recorded',
      message: `Accounting recorded your cash payment of ${acceptedAmount.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}.`,
      type: 'payment_verified'
    });
  }

  return json(200, { payment, paymentPlan: updatedPlan });
}
