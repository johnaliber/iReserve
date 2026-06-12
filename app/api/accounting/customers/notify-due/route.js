import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatPeso } from '@/lib/payments/paymentMath';
import { canManageVillagePayments } from '@/lib/auth/canManageVillagePayments';
import { createNotification } from '@/lib/notifications/createNotification';

export const dynamic = 'force-dynamic';

function json(status, payload) {
  return Response.json(payload, { status });
}

export async function POST(request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { planId, messageType = 'payment_reminder' } = await request.json();

  if (!planId) {
    return json(400, { error: 'Payment plan ID is required.' });
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

  if (!['accounting', 'village_admin', 'super_admin'].includes(profile?.role)) {
    return json(403, { error: 'You do not have permission to notify customers.' });
  }

  const { data: plan, error: planError } = await admin
    .from('payment_plans')
    .select('*, reservations(reservation_code, properties(block_number, lot_number))')
    .eq('id', planId)
    .single();

  if (planError || !plan) {
    return json(404, { error: 'Customer payment plan was not found.' });
  }

  if (!await canManageVillagePayments(supabase, user.id, profile?.role, plan.village_id)) {
    return json(403, { error: 'You do not have payment access to this village.' });
  }

  if (!plan.customer_id) {
    return json(400, { error: 'This payment plan is not linked to a customer account.' });
  }

  const propertyLabel = plan.reservations?.properties
    ? `Block ${plan.reservations.properties.block_number || '-'}, Lot ${plan.reservations.properties.lot_number || '-'}`
    : 'your reservation';
  const amount = formatPeso(plan.remaining_balance || 0);
  const isFullBalanceReminder = messageType === 'full_balance_due';
  const title = messageType === 'overdue'
    ? 'Payment Overdue'
    : isFullBalanceReminder
      ? 'Full Payment Balance Due'
      : 'Upcoming Payment Reminder';
  const message = messageType === 'overdue'
    ? `Your account for ${propertyLabel} has overdue payment/s. Please settle your remaining balance of ${amount} as soon as possible.`
    : isFullBalanceReminder
      ? `Your reservation fee for ${propertyLabel} is recorded. Your remaining full-payment balance is ${amount}.`
      : `Your account for ${propertyLabel} has an upcoming payment due. Please prepare your balance payment. Remaining balance: ${amount}.`;

  const result = await createNotification({
    admin,
    userId: plan.customer_id,
    title,
    message,
    type: messageType,
    villageId: plan.village_id,
    metadata: { reservationId: plan.reservation_id },
    actionUrl: '/customer/payments'
  });

  await admin.from('audit_logs').insert({
    user_id: user.id,
    village_id: plan.village_id,
    action: 'SEND_PAYMENT_REMINDER',
    entity_type: 'payment_plan',
    entity_id: plan.id,
    metadata: { messageType, customer_id: plan.customer_id }
  });

  return json(200, {
    ok: true,
    notificationId: result.notification.id,
    email: {
      sent: Boolean(result.email?.success),
      skipped: Boolean(result.email?.skipped),
      reason: result.email?.reason || result.email?.error || null
    }
  });
}
