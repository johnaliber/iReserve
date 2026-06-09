import { requireApiPermission, canManageUser } from '@/lib/auth/rbac';
import { logAuditEvent } from '@/lib/audit/logAuditEvent';

export const dynamic = 'force-dynamic';

async function getManagedContext(userId, permission) {
  const context = await requireApiPermission(permission);
  if (context.error) return context;
  if (!await canManageUser(context.admin, context.user.id, userId)) {
    return { ...context, error: Response.json({ error: 'You cannot manage this user.' }, { status: 403 }) };
  }
  return context;
}

export async function GET(_request, { params }) {
  const { userId } = await params;
  const context = await getManagedContext(userId, 'users.view');
  if (context.error) return context.error;
  const { admin } = context;

  const [{ data: profile }, { data: scopes }, { data: overrides }, { data: logs }, { data: roles }, { data: permissions }, { data: rolePermissions }, { data: villages }] = await Promise.all([
    admin.from('profiles').select('*').eq('id', userId).single(),
    admin.from('user_access_scopes').select('*, villages(id, name), properties(id, property_code)').eq('user_id', userId),
    admin.from('user_permissions').select('*, permissions(*)').eq('user_id', userId),
    admin.from('audit_logs').select('*, villages(name)').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
    admin.from('roles').select('*').order('display_name'),
    admin.from('permissions').select('*').order('category').order('name'),
    admin.from('role_permissions').select('*'),
    admin.from('villages').select('id, name, village_code').order('name')
  ]);
  if (!profile) return Response.json({ error: 'User not found.' }, { status: 404 });
  return Response.json({ profile, scopes: scopes || [], overrides: overrides || [], logs: logs || [], roles: roles || [], permissions: permissions || [], rolePermissions: rolePermissions || [], villages: villages || [] });
}

export async function PATCH(request, { params }) {
  const { userId } = await params;
  const context = await getManagedContext(userId, 'users.update');
  if (context.error) return context.error;
  const { admin, user } = context;
  const body = await request.json();
  const { data: before } = await admin.from('profiles').select('*').eq('id', userId).single();
  if (!before) return Response.json({ error: 'User not found.' }, { status: 404 });

  const profileUpdates = {};
  for (const key of ['full_name', 'phone', 'role', 'status', 'suspension_reason']) {
    if (body[key] !== undefined) profileUpdates[key] = body[key];
  }
  if (body.role && body.role !== before.role) {
    const roleContext = await requireApiPermission('users.assign_role');
    if (roleContext.error) return roleContext.error;
  }
  if (body.status && body.status !== before.status) {
    const statusContext = await requireApiPermission('users.deactivate');
    if (statusContext.error) return statusContext.error;
  }
  if (Object.keys(profileUpdates).length) {
    profileUpdates.updated_at = new Date().toISOString();
    const { error } = await admin.from('profiles').update(profileUpdates).eq('id', userId);
    if (error) return Response.json({ error: error.message }, { status: 400 });
  }

  if (Array.isArray(body.scopes)) {
    const scopeContext = await requireApiPermission('users.assign_scope');
    if (scopeContext.error) return scopeContext.error;
    await admin.from('user_access_scopes').delete().eq('user_id', userId);
    await admin.from('user_villages').delete().eq('user_id', userId);
    const scopeRows = body.scopes.map((scope) => ({
      user_id: userId,
      scope_type: scope.scope_type,
      village_id: scope.village_id || null,
      property_id: scope.property_id || null,
      created_by: user.id
    }));
    if (scopeRows.length) await admin.from('user_access_scopes').insert(scopeRows);
    const effectiveRole = body.role || before.role;
    const villageScopes = scopeRows.filter((scope) => scope.scope_type === 'village' && scope.village_id);
    if (!['super_admin', 'customer', 'guest'].includes(effectiveRole) && villageScopes.length) {
      await admin.from('user_villages').insert(villageScopes.map((scope) => ({
        user_id: userId,
        village_id: scope.village_id,
        role: effectiveRole
      })));
    }
  }

  if (Array.isArray(body.permissionOverrides)) {
    const permissionContext = await requireApiPermission('users.assign_role');
    if (permissionContext.error) return permissionContext.error;
    await admin.from('user_permissions').delete().eq('user_id', userId);
    const rows = body.permissionOverrides
      .filter((item) => ['allow', 'deny'].includes(item.permission_state))
      .map((item) => ({
        user_id: userId,
        permission_id: item.permission_id,
        permission_state: item.permission_state,
        created_by: user.id
      }));
    if (rows.length) await admin.from('user_permissions').insert(rows);
  }

  const changedRole = body.role && body.role !== before.role;
  const changedStatus = body.status && body.status !== before.status;
  await logAuditEvent({
    admin,
    request,
    userId: user.id,
    villageId: body.scopes?.find((scope) => scope.village_id)?.village_id || null,
    action: changedRole ? 'user_role_changed' : changedStatus ? (body.status === 'active' ? 'user_reactivated' : 'user_deactivated') : 'user_updated',
    entityType: 'user',
    entityId: userId,
    description: changedRole ? `Changed user role from ${before.role} to ${body.role}.` : changedStatus ? `Changed account status to ${body.status}.` : 'Updated user profile, access, or permissions.',
    metadata: { old_role: before.role, new_role: body.role || before.role, old_status: before.status, new_status: body.status || before.status }
  });

  return Response.json({ success: true });
}

export async function DELETE(request, { params }) {
  const { userId } = await params;
  const context = await getManagedContext(userId, 'users.delete');
  if (context.error) return context.error;
  const { admin, user } = context;
  const { data: target } = await admin.from('profiles').select('full_name, email, role').eq('id', userId).single();
  if (target?.role === 'super_admin') return Response.json({ error: 'System super admin accounts cannot be deleted.' }, { status: 400 });
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  await logAuditEvent({ admin, request, userId: user.id, action: 'user_deleted', entityType: 'user', entityId: userId, description: `Deleted user ${target?.full_name || target?.email || userId}.`, metadata: target || {} });
  return Response.json({ success: true });
}
