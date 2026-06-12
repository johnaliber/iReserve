import { requireApiPermission, getUserVillageIds } from '@/lib/auth/rbac';
import { logAuditEvent } from '@/lib/audit/logAuditEvent';
import { createNotification } from '@/lib/notifications/createNotification';

export const dynamic = 'force-dynamic';

export async function GET() {
  const context = await requireApiPermission('users.view');
  if (context.error) return context.error;
  const { admin, user, profile } = context;

  const [{ data: profiles, error }, { data: villages }, { data: scopes }, { data: overrides }, authUsers] = await Promise.all([
    admin.from('profiles').select('*').order('created_at', { ascending: false }),
    admin.from('villages').select('id, name, village_code').order('name'),
    admin.from('user_access_scopes').select('*, villages(id, name), properties(id, property_code)'),
    admin.from('user_permissions').select('*, permissions(id, name, display_name, category)'),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  ]);
  if (error) return Response.json({ error: error.message }, { status: 400 });

  let visibleProfiles = profiles || [];
  if (profile.role === 'village_admin') {
    const villageIds = new Set(await getUserVillageIds(admin, user.id));
    const visibleUserIds = new Set((scopes || [])
      .filter((scope) => scope.scope_type === 'village' && villageIds.has(scope.village_id))
      .map((scope) => scope.user_id));
    visibleProfiles = visibleProfiles.filter((item) => visibleUserIds.has(item.id) && item.role !== 'super_admin');
  }

  const authById = new Map((authUsers.data?.users || []).map((item) => [item.id, item]));
  return Response.json({
    users: visibleProfiles.map((item) => ({
      ...item,
      last_login_at: item.last_login_at || authById.get(item.id)?.last_sign_in_at || null,
      scopes: (scopes || []).filter((scope) => scope.user_id === item.id),
      permission_overrides: (overrides || []).filter((override) => override.user_id === item.id)
    })),
    villages: villages || []
  });
}

export async function POST(request) {
  const context = await requireApiPermission('users.create');
  if (context.error) return context.error;
  const { admin, user } = context;
  const body = await request.json();
  const {
    fullName,
    email,
    phone = '',
    password,
    role = 'customer',
    status = 'active',
    villageIds = []
  } = body || {};

  if (!fullName?.trim() || !email?.trim() || !password || password.length < 8) {
    return Response.json({ error: 'Full name, email, and a password of at least 8 characters are required.' }, { status: 400 });
  }

  const { data: roleRecord } = await admin.from('roles').select('name').eq('name', role).single();
  if (!roleRecord) return Response.json({ error: 'Invalid role.' }, { status: 400 });

  const { data: created, error } = await admin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName.trim(), role }
  });
  if (error || !created.user) return Response.json({ error: error?.message || 'User could not be created.' }, { status: 400 });

  const userId = created.user.id;
  await admin.from('profiles').upsert({
    id: userId,
    full_name: fullName.trim(),
    email: email.trim().toLowerCase(),
    phone,
    role,
    status
  });

  const scopeRows = role === 'super_admin'
    ? [{ user_id: userId, scope_type: 'global', created_by: user.id }]
    : ['customer', 'guest'].includes(role)
      ? [{ user_id: userId, scope_type: 'own_records', created_by: user.id }]
      : villageIds.map((villageId) => ({ user_id: userId, scope_type: 'village', village_id: villageId, created_by: user.id }));
  if (scopeRows.length) await admin.from('user_access_scopes').insert(scopeRows);

  if (!['super_admin', 'customer', 'guest'].includes(role) && villageIds.length) {
    await admin.from('user_villages').insert(villageIds.map((villageId) => ({
      user_id: userId,
      village_id: villageId,
      role
    })));
  }

  await logAuditEvent({
    admin,
    request,
    userId: user.id,
    action: 'user_created',
    entityType: 'user',
    entityId: userId,
    description: `Created user ${fullName} with role ${role}.`,
    metadata: { email: email.trim().toLowerCase(), role, village_ids: villageIds }
  });

  await createNotification({
    admin,
    userId,
    title: 'Welcome to iReserve',
    message: `Your ${role.replaceAll('_', ' ')} account has been created and is ${status}.`,
    type: 'account_created',
    actionUrl: '/auth/login'
  }).catch((notificationError) => {
    console.error('[notification] Account creation notification failed:', notificationError.message);
  });

  return Response.json({ userId }, { status: 201 });
}
