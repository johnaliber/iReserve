import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAuditEvent } from '@/lib/audit/logAuditEvent';
import { createNotification } from '@/lib/notifications/createNotification';

export const dynamic = 'force-dynamic';

function json(status, payload) {
  return Response.json(payload, { status });
}

async function canManageVillage(admin, userId, role, villageId) {
  if (role === 'super_admin') return true;
  if (role !== 'village_admin' || !villageId) return false;

  const [{ data: legacy }, { data: scope }] = await Promise.all([
    admin.from('user_villages').select('id').eq('user_id', userId).eq('village_id', villageId).eq('role', 'village_admin').maybeSingle(),
    admin.from('user_access_scopes').select('id').eq('user_id', userId).eq('village_id', villageId).eq('scope_type', 'village').maybeSingle()
  ]);
  return Boolean(legacy || scope);
}

export async function POST(request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { reservationId, status } = await request.json();
  const allowedStatuses = ['approved', 'reserved', 'rejected', 'cancelled', 'expired', 'converted_to_sale'];

  if (!reservationId || !allowedStatuses.includes(status)) {
    return json(400, { error: 'A valid reservation and status are required.' });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json(401, { error: 'You must be signed in.' });

  const { data: profile } = await admin.from('profiles').select('role, status').eq('id', user.id).single();
  if (!profile || profile.status !== 'active') {
    return json(403, { error: 'Your account cannot update reservations.' });
  }

  const { data: reservation, error: reservationError } = await admin
    .from('reservations')
    .select('*, properties(id, property_code, block_number, lot_number), villages(name)')
    .eq('id', reservationId)
    .single();

  if (reservationError || !reservation) return json(404, { error: 'Reservation was not found.' });
  if (!await canManageVillage(admin, user.id, profile.role, reservation.village_id)) {
    return json(403, { error: 'You do not have access to this village reservation.' });
  }

  const approved = status === 'approved' || status === 'reserved';
  const released = ['rejected', 'cancelled', 'expired'].includes(status);
  const propertyStatus = approved ? 'reserved' : status === 'converted_to_sale' ? 'sold' : 'available';

  const { data: updatedReservation, error: updateError } = await admin
    .from('reservations')
    .update({
      status,
      approved_at: approved ? new Date().toISOString() : null,
      cancelled_at: released ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq('id', reservation.id)
    .select()
    .single();

  if (updateError) return json(400, { error: updateError.message });

  const [{ error: propertyError }, { error: paymentError }] = await Promise.all([
    admin.from('properties').update({ status: propertyStatus, updated_at: new Date().toISOString() }).eq('id', reservation.property_id),
    admin.from('payments').update({ payment_status: approved ? 'verified' : released ? 'rejected' : 'pending_verification' }).eq('reservation_id', reservation.id)
  ]);

  if (propertyError || paymentError) {
    return json(400, { error: propertyError?.message || paymentError?.message });
  }

  await logAuditEvent({
    admin,
    request,
    userId: user.id,
    villageId: reservation.village_id,
    action: `reservation_${status}`,
    entityType: 'reservation',
    entityId: reservation.id,
    description: `Updated reservation ${reservation.reservation_code} to ${status}.`,
    metadata: { customer_id: reservation.customer_id, property_id: reservation.property_id }
  });

  let notificationResult = null;
  if (reservation.customer_id) {
    const propertyLabel = reservation.properties?.property_code
      || `Block ${reservation.properties?.block_number || '-'}, Lot ${reservation.properties?.lot_number || '-'}`;
    const titles = {
      approved: 'Reservation Approved',
      reserved: 'Reservation Approved',
      rejected: 'Reservation Rejected',
      cancelled: 'Reservation Cancelled',
      expired: 'Reservation Expired',
      converted_to_sale: 'Reservation Completed'
    };
    const messages = {
      approved: `Your reservation for ${propertyLabel} at ${reservation.villages?.name || 'the village'} has been approved.`,
      reserved: `Your reservation for ${propertyLabel} at ${reservation.villages?.name || 'the village'} has been approved.`,
      rejected: `Your reservation for ${propertyLabel} was rejected. Review your account or contact support for assistance.`,
      cancelled: `Your reservation for ${propertyLabel} was cancelled.`,
      expired: `Your reservation hold for ${propertyLabel} has expired.`,
      converted_to_sale: `Your reservation for ${propertyLabel} has been completed and converted to a sale.`
    };

    notificationResult = await createNotification({
      admin,
      userId: reservation.customer_id,
      title: titles[status],
      message: messages[status],
      type: `reservation_${status}`,
      villageId: reservation.village_id,
      metadata: { reservationId: reservation.id },
      actionUrl: '/customer/reservations'
    }).catch((error) => {
      console.error('[notification] Reservation status notification failed:', error.message);
      return null;
    });
  }

  return json(200, {
    reservation: updatedReservation,
    notificationCreated: Boolean(notificationResult?.notification),
    emailSent: Boolean(notificationResult?.email?.success)
  });
}
