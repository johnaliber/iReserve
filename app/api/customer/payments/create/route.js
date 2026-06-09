import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createFallbackPaymentSchedule, validatePaymentAmount } from '@/lib/payments/server';

export const dynamic = 'force-dynamic';

function json(status, payload) {
  return Response.json(payload, { status });
}

function fallbackRef() {
  return `PAY-${Date.now().toString(36).toUpperCase()}`;
}

export async function POST(request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const body = await request.json();
  const {
    paymentPlanId,
    paymentScheduleId,
    amount,
    paymentMethod = 'gcash',
    referenceNumber
  } = body || {};

  if (!paymentPlanId) {
    return json(400, { error: 'Payment plan is required.' });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return json(401, { error: 'You must be signed in.' });

  const { data: plan, error: planError } = await admin
    .from('payment_plans')
    .select('*, reservations(id, customer_id, property_id, reservation_code)')
    .eq('id', paymentPlanId)
    .single();

  if (planError || !plan) {
    return json(404, { error: 'Payment plan was not found.' });
  }

  if (plan.customer_id !== user.id && plan.reservations?.customer_id !== user.id) {
    return json(403, { error: 'You can only pay your own account ledger.' });
  }

  const { data: documents } = await admin
    .from('documents')
    .select('status')
    .eq('reservation_id', plan.reservation_id);

  if (!documents?.length || documents.some((document) => document.status !== 'approved')) {
    return json(409, { error: 'Your documents must be approved before submitting your first payment.' });
  }

  let schedule = null;
  if (paymentScheduleId) {
    const { data: scheduleRow, error: scheduleError } = await admin
      .from('payment_schedule')
      .select('*')
      .eq('id', paymentScheduleId)
      .eq('payment_plan_id', paymentPlanId)
      .single();

    if (scheduleError || !scheduleRow) {
      return json(404, { error: 'Payment due was not found.' });
    }

    schedule = scheduleRow;
  } else {
    schedule = await createFallbackPaymentSchedule(admin, paymentPlanId);
  }

  if (schedule.status === 'paid' || Number(schedule.remaining_due || 0) <= 0) {
    return json(400, { error: 'This due is already paid.' });
  }

  const { data: pendingPayment } = await admin
    .from('payments')
    .select('id')
    .eq('payment_schedule_id', schedule.id)
    .eq('customer_id', user.id)
    .eq('payment_status', 'pending_verification')
    .maybeSingle();

  if (pendingPayment) {
    return json(409, { error: 'This due already has a payment waiting for accounting verification.' });
  }

  const { maximumPayableAmount, amount: acceptedAmount } = await validatePaymentAmount(admin, {
    paymentPlanId,
    paymentScheduleId: schedule.id,
    submittedAmount: amount || schedule.remaining_due,
    paymentPurpose: 'monthly_installment'
  });

  const { data: payment, error: paymentError } = await admin
    .from('payments')
    .insert({
      reservation_id: plan.reservation_id,
      payment_plan_id: paymentPlanId,
      payment_schedule_id: schedule.id,
      village_id: plan.village_id,
      customer_id: user.id,
      amount: acceptedAmount,
      payment_method: paymentMethod,
      payment_status: 'pending_verification',
      payment_purpose: 'monthly_installment',
      reference_number: referenceNumber || fallbackRef(),
      proof_url: 'QR payment submitted by customer',
      maximum_payable_amount: maximumPayableAmount,
      submitted_amount: acceptedAmount,
      accepted_amount: acceptedAmount,
      excess_amount: 0,
      is_overpayment: false,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (paymentError) {
    return json(400, { error: paymentError.message });
  }

  return json(200, { payment });
}
