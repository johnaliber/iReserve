import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAuditEvent } from '@/lib/audit/logAuditEvent';
import { getSuperAdminRecipients, getVillageAdminRecipients } from '@/lib/email/getNotificationRecipients';
import { createNotification, createNotifications } from '@/lib/notifications/createNotification';

export const dynamic = 'force-dynamic';

function json(status, payload) {
  return Response.json(payload, { status });
}

export async function POST(request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const body = await request.json();
  const { reservationId, preferredDate, preferredTime, notes } = body || {};

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json(401, { error: 'You must be signed in.' });
  if (!reservationId || !preferredDate || !preferredTime) {
    return json(400, { error: 'Reservation, date, and time are required.' });
  }

  const { data: reservation, error: reservationError } = await admin
    .from('reservations')
    .select('id, customer_id, village_id, property_id, properties(property_code, block_number, lot_number), villages(name)')
    .eq('id', reservationId)
    .eq('customer_id', user.id)
    .single();

  if (reservationError || !reservation) {
    return json(404, { error: 'Your reservation was not found.' });
  }

  const { data: viewing, error } = await admin
    .from('site_viewings')
    .insert({
      village_id: reservation.village_id,
      property_id: reservation.property_id,
      reservation_id: reservation.id,
      customer_id: user.id,
      preferred_date: preferredDate,
      preferred_time: preferredTime,
      notes: String(notes || '').trim() || null,
      status: 'pending'
    })
    .select()
    .single();

  if (error) return json(400, { error: error.message });

  const propertyLabel = reservation.properties?.property_code
    || `Block ${reservation.properties?.block_number || '-'}, Lot ${reservation.properties?.lot_number || '-'}`;

  await Promise.allSettled([
    logAuditEvent({
      admin,
      request,
      userId: user.id,
      villageId: reservation.village_id,
      action: 'site_viewing_submitted',
      entityType: 'site_viewing',
      entityId: viewing.id,
      description: `Submitted a site viewing request for ${propertyLabel}.`,
      metadata: { reservation_id: reservation.id, preferred_date: preferredDate, preferred_time: preferredTime }
    }),
    createNotification({
      admin,
      userId: user.id,
      title: 'Site Viewing Request Submitted',
      message: `Your site viewing request for ${propertyLabel} on ${preferredDate} at ${preferredTime} is waiting for village review.`,
      type: 'site_viewing_submitted',
      villageId: reservation.village_id,
      metadata: { reservationId: reservation.id, siteViewingId: viewing.id },
      actionUrl: '/customer/site-viewing'
    })
  ]);

  const [villageAdmins, superAdmins] = await Promise.all([
    getVillageAdminRecipients(admin, reservation.village_id),
    getSuperAdminRecipients(admin)
  ]);
  await createNotifications({
    admin,
    recipients: [...villageAdmins, ...superAdmins],
    title: 'New Site Viewing Request',
    message: `A customer requested a site viewing for ${propertyLabel} at ${reservation.villages?.name || 'the village'} on ${preferredDate} at ${preferredTime}.`,
    type: 'site_viewing_submitted_admin',
    villageId: reservation.village_id,
    metadata: { reservationId: reservation.id, siteViewingId: viewing.id },
    actionUrl: '/village-admin/site-viewings'
  });

  return json(201, { siteViewing: viewing });
}
