import { getAuthContext } from '@/lib/auth/rbac';
import { logAuditEvent } from '@/lib/audit/logAuditEvent';
import { getSuperAdminRecipients, getVillageAdminRecipients } from '@/lib/email/getNotificationRecipients';
import { createNotifications } from '@/lib/notifications/createNotification';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const { admin, user, profile } = await getAuthContext();
  if (!user || !profile || !admin) return Response.json({ error: 'Authentication required.' }, { status: 401 });
  if (!['architect', 'super_admin'].includes(profile.role) || profile.status !== 'active') {
    return Response.json({ error: 'You cannot publish blueprints.' }, { status: 403 });
  }

  const { blueprintId } = await request.json();
  const { data: blueprint, error } = await admin
    .from('blueprints')
    .select('id, village_id, name, status, villages(name)')
    .eq('id', blueprintId)
    .single();
  if (error || !blueprint) return Response.json({ error: 'Blueprint was not found.' }, { status: 404 });

  if (profile.role === 'architect') {
    const [{ data: legacy }, { data: scope }] = await Promise.all([
      admin.from('user_villages').select('id').eq('user_id', user.id).eq('village_id', blueprint.village_id).eq('role', 'architect').maybeSingle(),
      admin.from('user_access_scopes').select('id').eq('user_id', user.id).eq('village_id', blueprint.village_id).eq('scope_type', 'village').maybeSingle()
    ]);
    if (!legacy && !scope) return Response.json({ error: 'You are not assigned to this village.' }, { status: 403 });
  }

  const publishedAt = new Date().toISOString();
  const { data: published, error: publishError } = await admin
    .from('blueprints')
    .update({ status: 'published', published_at: publishedAt })
    .eq('id', blueprint.id)
    .select()
    .single();
  if (publishError) return Response.json({ error: publishError.message }, { status: 400 });

  await logAuditEvent({
    admin,
    request,
    userId: user.id,
    villageId: blueprint.village_id,
    action: 'blueprint_published',
    entityType: 'blueprint',
    entityId: blueprint.id,
    description: `Published blueprint ${blueprint.name}.`
  });

  const [villageAdmins, superAdmins] = await Promise.all([
    getVillageAdminRecipients(admin, blueprint.village_id),
    getSuperAdminRecipients(admin)
  ]);
  await createNotifications({
    admin,
    recipients: [...villageAdmins, ...superAdmins],
    title: 'Blueprint Published',
    message: `${blueprint.name} for ${blueprint.villages?.name || 'the village'} has been published and is available for preview.`,
    type: 'blueprint_published',
    villageId: blueprint.village_id,
    actionUrl: '/village-admin/blueprint-preview'
  });

  return Response.json({ blueprint: published });
}
