import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canManageVillagePayments } from '@/lib/auth/canManageVillagePayments';
import { hasPermission } from '@/lib/auth/rbac';
import { logAuditEvent } from '@/lib/audit/logAuditEvent';

export const dynamic = 'force-dynamic';

function json(status, payload) {
  return Response.json(payload, { status });
}

export async function POST(request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { paymentId, rejectionReason } = await request.json();

  if (!paymentId || !rejectionReason?.trim()) {
    return json(400, { error: 'Payment and rejection reason are required.' });
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
    || !await hasPermission(admin, user.id, 'payments.reject')) {
    return json(403, { error: 'You do not have permission to reject payments.' });
  }

  const { data: payment, error: paymentError } = await admin
    .from('payments')
    .select('*, reservations(id, property_id, customer_id, reservation_code, properties(block_number, lot_number))')
    .eq('id', paymentId)
    .single();

  if (paymentError || !payment) return json(404, { error: 'Payment was not found.' });

  if (!await canManageVillagePayments(supabase, user.id, profile?.role, payment.village_id)) {
    return json(403, { error: 'You do not have payment access to this village.' });
  }

  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from('payments')
    .update({
      payment_status: 'rejected',
      rejection_reason: rejectionReason.trim(),
      verified_by: user.id,
      verified_at: now
    })
    .eq('id', payment.id);

  if (updateError) return json(400, { error: updateError.message });

  await admin
    .from('reservations')
    .update({ status: 'rejected', cancelled_at: now })
    .eq('id', payment.reservation_id);

  await admin
    .from('properties')
    .update({ status: 'available', updated_at: now })
    .eq('id', payment.reservations?.property_id);

  await logAuditEvent({
    admin,
    request,
    userId: user.id,
    villageId: payment.village_id,
    action: 'payment_rejected',
    entityType: 'payment',
    entityId: payment.id,
    description: `Rejected payment for reservation ${payment.reservations?.reservation_code || payment.reservation_id}.`,
    metadata: { rejection_reason: rejectionReason.trim() }
  });

  const customerId = payment.customer_id || payment.reservations?.customer_id;
  if (customerId) {
    await admin.from('notifications').insert({
      user_id: customerId,
      title: 'Payment Receipt Rejected',
      message: `Your payment for Block ${payment.reservations?.properties?.block_number || '-'}, Lot ${payment.reservations?.properties?.lot_number || '-'} was rejected. Reason: ${rejectionReason.trim()}`,
      type: 'payment_rejected'
    });
  }

  return json(200, { paymentId: payment.id });
}
