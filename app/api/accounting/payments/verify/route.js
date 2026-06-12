import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ensureNextPaymentSchedule, recalculatePaymentIndicators } from '@/lib/payments/server';
import { roundMoney } from '@/lib/payments/paymentMath';
import { canManageVillagePayments } from '@/lib/auth/canManageVillagePayments';
import { hasPermission } from '@/lib/auth/rbac';
import { logAuditEvent } from '@/lib/audit/logAuditEvent';
import { createNotification } from '@/lib/notifications/createNotification';

export const dynamic = 'force-dynamic';

function json(status, payload) {
  return Response.json(payload, { status });
}

export async function POST(request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const body = await request.json();
  const { paymentId, officialReceiptNumber, notes } = body || {};

  if (!paymentId) {
    return json(400, { error: 'Payment ID is required.' });
  }

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
    || !await hasPermission(admin, user.id, 'payments.verify')) {
    return json(403, { error: 'You do not have permission to verify payments.' });
  }

  const { data: payment, error: paymentFetchError } = await admin
    .from('payments')
    .select('*, reservations(property_id, customer_id, reservation_code, properties(block_number, lot_number))')
    .eq('id', paymentId)
    .single();

  if (paymentFetchError || !payment) {
    return json(404, { error: 'Payment was not found.' });
  }

  if (!await canManageVillagePayments(supabase, user.id, profile?.role, payment.village_id)) {
    return json(403, { error: 'You do not have payment access to this village.' });
  }

  const { data: documents } = await admin
    .from('documents')
    .select('status')
    .eq('reservation_id', payment.reservation_id);

  if (!documents?.length || documents.some((document) => document.status !== 'approved')) {
    return json(409, { error: 'Approve the customer documents before verifying this payment.' });
  }

  const { error: paymentError } = await admin
    .from('payments')
    .update({
      payment_status: 'verified',
      official_receipt_number: officialReceiptNumber,
      accounting_notes: notes || 'Payment verified by accounting.',
      verified_by: user.id,
      verified_at: new Date().toISOString()
    })
    .eq('id', paymentId);

  if (paymentError) return json(400, { error: paymentError.message });

  let updatedSchedule = null;
  if (payment.payment_schedule_id) {
    const { data: schedule } = await admin
      .from('payment_schedule')
      .select('*')
      .eq('id', payment.payment_schedule_id)
      .single();

    if (schedule) {
      const amountPaid = roundMoney(Number(schedule.amount_paid || 0) + Number(payment.amount || 0));
      const remainingDue = roundMoney(Math.max(0, Number(schedule.amount_due || 0) - amountPaid));
      const { data: scheduleUpdate } = await admin
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

      updatedSchedule = scheduleUpdate || {
        ...schedule,
        amount_paid: amountPaid,
        remaining_due: remainingDue,
        status: remainingDue <= 0 ? 'paid' : 'partially_paid'
      };
    }
  }

  let updatedPlan = null;
  if (payment.payment_plan_id) {
    if (updatedSchedule?.status === 'paid') {
      await ensureNextPaymentSchedule(admin, payment.payment_plan_id, updatedSchedule);
    }
    updatedPlan = await recalculatePaymentIndicators(admin, payment.payment_plan_id);
  }

  await admin
    .from('reservations')
    .update({
      status: updatedPlan?.status === 'fully_paid' ? 'converted_to_sale' : 'reserved',
      approved_at: new Date().toISOString()
    })
    .eq('id', payment.reservation_id);

  await admin
    .from('properties')
    .update({
      status: updatedPlan?.status === 'fully_paid' ? 'sold' : 'reserved',
      updated_at: new Date().toISOString()
    })
    .eq('id', payment.reservations?.property_id);

  await logAuditEvent({
    admin,
    request,
    userId: user.id,
    villageId: payment.village_id,
    action: 'payment_verified',
    entityType: 'payment',
    entityId: paymentId,
    description: `Verified payment for reservation ${payment.reservations?.reservation_code || payment.reservation_id}.`,
    metadata: { official_receipt_number: officialReceiptNumber, payment_plan_id: payment.payment_plan_id }
  });

  if (payment.customer_id) {
    const isFullyPaid = updatedPlan?.status === 'fully_paid';
    const remainingBalance = Number(updatedPlan?.remaining_balance || 0);
    await createNotification({
      admin,
      userId: payment.customer_id,
      title: isFullyPaid ? 'Full Payment Completed' : 'Payment Verified',
      message: isFullyPaid
        ? `Your full payment for Block ${payment.reservations?.properties?.block_number || '-'}, Lot ${payment.reservations?.properties?.lot_number || '-'} has been completed.`
        : `Your payment for Block ${payment.reservations?.properties?.block_number || '-'}, Lot ${payment.reservations?.properties?.lot_number || '-'} has been verified. Remaining balance: PHP ${remainingBalance.toLocaleString('en-PH')}.`,
      type: isFullyPaid ? 'full_payment_completed' : 'payment_verified',
      villageId: payment.village_id,
      metadata: {
        reservationId: payment.reservation_id,
        paymentId: payment.id
      },
      actionUrl: '/customer/payments'
    }).catch((notificationError) => {
      console.error('[notification] Payment verification notification failed:', notificationError.message);
    });
  }

  return json(200, { paymentId, paymentPlan: updatedPlan });
}
