import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAuditEvent } from '@/lib/audit/logAuditEvent';
import { createNotification } from '@/lib/notifications/createNotification';

export const dynamic = 'force-dynamic';

function json(status, payload) {
  return Response.json(payload, { status });
}

function formatViewingDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatViewingTime(value) {
  if (!value) return '';
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit'
  });
}

async function canManageVillage(admin, userId, role, villageId) {
  if (role === 'super_admin') return true;
  if (role !== 'village_admin' || !villageId) return false;

  const [{ data: legacyAssignment }, { data: scopeAssignment }] = await Promise.all([
    admin
      .from('user_villages')
      .select('id')
      .eq('user_id', userId)
      .eq('village_id', villageId)
      .eq('role', 'village_admin')
      .maybeSingle(),
    admin
      .from('user_access_scopes')
      .select('id')
      .eq('user_id', userId)
      .eq('village_id', villageId)
      .eq('scope_type', 'village')
      .maybeSingle()
  ]);

  return Boolean(legacyAssignment || scopeAssignment);
}

export async function POST(request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { viewingId, status } = await request.json();

  if (!viewingId || !['approved', 'rejected', 'completed', 'cancelled'].includes(status)) {
    return json(400, { error: 'A valid site viewing and status are required.' });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return json(401, { error: 'You must be signed in.' });

  const { data: profile } = await admin
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .single();

  if (!profile || profile.status !== 'active') {
    return json(403, { error: 'Your account is not allowed to update site viewings.' });
  }

  const { data: viewing, error: viewingError } = await admin
    .from('site_viewings')
    .select(`
      *,
      properties(property_code, block_number, lot_number),
      villages(name)
    `)
    .eq('id', viewingId)
    .single();

  if (viewingError || !viewing) {
    return json(404, { error: 'Site viewing appointment was not found.' });
  }

  if (!await canManageVillage(admin, user.id, profile.role, viewing.village_id)) {
    return json(403, { error: 'You do not have access to this village appointment.' });
  }

  const { data: updatedViewing, error: updateError } = await admin
    .from('site_viewings')
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .eq('id', viewing.id)
    .select()
    .single();

  if (updateError) return json(400, { error: updateError.message });

  await logAuditEvent({
    admin,
    request,
    userId: user.id,
    villageId: viewing.village_id,
    action: `site_viewing_${status}`,
    entityType: 'site_viewing',
    entityId: viewing.id,
    description: `Updated site viewing appointment to ${status}.`,
    metadata: {
      customer_id: viewing.customer_id,
      reservation_id: viewing.reservation_id,
      preferred_date: viewing.preferred_date,
      preferred_time: viewing.preferred_time
    }
  });

  let notificationResult = null;
  if (viewing.customer_id) {
    const propertyLabel = viewing.properties?.property_code
      || `Block ${viewing.properties?.block_number || '-'}, Lot ${viewing.properties?.lot_number || '-'}`;
    const dateLabel = formatViewingDate(viewing.preferred_date);
    const timeLabel = formatViewingTime(viewing.preferred_time);
    const title = status === 'approved'
      ? 'Site Viewing Approved'
      : status === 'rejected'
        ? 'Site Viewing Rejected'
        : status === 'cancelled'
          ? 'Site Viewing Cancelled'
          : 'Site Viewing Completed';
    const message = status === 'approved'
      ? `Your site viewing for ${propertyLabel} at ${viewing.villages?.name || 'the village'} is approved for ${dateLabel} at ${timeLabel}.`
      : status === 'rejected'
        ? `Your site viewing request for ${propertyLabel} on ${dateLabel} at ${timeLabel} was rejected.`
        : status === 'cancelled'
          ? `Your site viewing for ${propertyLabel} on ${dateLabel} at ${timeLabel} was cancelled.`
          : `Your site viewing for ${propertyLabel} on ${dateLabel} at ${timeLabel} was marked completed.`;

    notificationResult = await createNotification({
      admin,
      userId: viewing.customer_id,
      title,
      message,
      type: `site_viewing_${status}`,
      villageId: viewing.village_id,
      metadata: {
        reservationId: viewing.reservation_id,
        siteViewingId: viewing.id
      },
      actionUrl: '/customer/site-viewing'
    }).catch((notificationError) => {
      console.error('[notification] Site viewing status notification failed:', notificationError.message);
      return null;
    });
  }

  return json(200, {
    siteViewing: updatedViewing,
    notificationCreated: Boolean(notificationResult?.notification),
    emailSent: Boolean(notificationResult?.email?.success)
  });
}
