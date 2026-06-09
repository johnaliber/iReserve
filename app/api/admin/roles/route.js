import { requireApiPermission } from '@/lib/auth/rbac';
import { logAuditEvent } from '@/lib/audit/logAuditEvent';
import { PERMISSION_PRESETS, SYSTEM_ROLE_NAMES } from '@/lib/auth/permissionPresets';

export const dynamic = 'force-dynamic';

export async function GET() {
  const context = await requireApiPermission('users.assign_role');
  if (context.error) return context.error;
  const { admin } = context;
  const [{ data: roles }, { data: permissions }, { data: rolePermissions }, { data: profiles }] = await Promise.all([
    admin.from('roles').select('*').order('display_name'),
    admin.from('permissions').select('*').order('category').order('name'),
    admin.from('role_permissions').select('*'),
    admin.from('profiles').select('id, role')
  ]);
  return Response.json({ roles: roles || [], permissions: permissions || [], rolePermissions: rolePermissions || [], profiles: profiles || [] });
}

export async function POST(request) {
  const context = await requireApiPermission('users.assign_role');
  if (context.error) return context.error;
  const { admin, user } = context;
  const body = await request.json();

  if (body.action === 'apply_preset') {
    const { roleId, presetName } = body;
    const preset = PERMISSION_PRESETS[presetName];
    const { data: role } = await admin.from('roles').select('*').eq('id', roleId).single();
    if (!role || !preset) return Response.json({ error: 'Role or permission preset was not found.' }, { status: 404 });
    if (role.name === 'super_admin') return Response.json({ error: 'Super Admin already has full system access.' }, { status: 400 });

    const permissionsQuery = admin.from('permissions').select('id, name');
    const { data: presetPermissions } = preset.permissionNames.includes('*')
      ? await permissionsQuery
      : await permissionsQuery.in('name', preset.permissionNames);
    await admin.from('role_permissions').delete().eq('role_id', roleId);
    if (presetPermissions?.length) {
      await admin.from('role_permissions').insert(
        presetPermissions.map((permission) => ({ role_id: roleId, permission_id: permission.id }))
      );
    }
    await logAuditEvent({
      admin,
      request,
      userId: user.id,
      action: 'role_permissions_updated',
      entityType: 'role',
      entityId: roleId,
      description: `Applied the ${preset.label} permission preset to ${role.display_name}.`,
      metadata: { preset_name: presetName }
    });
    return Response.json({ success: true });
  }

  if (body.action === 'restore_system_presets') {
    const [{ data: roles }, { data: permissions }] = await Promise.all([
      admin.from('roles').select('id, name').in('name', SYSTEM_ROLE_NAMES.filter((name) => name !== 'super_admin')),
      admin.from('permissions').select('id, name')
    ]);
    const roleIds = (roles || []).map((role) => role.id);
    if (roleIds.length) await admin.from('role_permissions').delete().in('role_id', roleIds);

    const permissionByName = new Map((permissions || []).map((permission) => [permission.name, permission.id]));
    const rows = (roles || []).flatMap((role) =>
      PERMISSION_PRESETS[role.name].permissionNames
        .map((name) => permissionByName.get(name))
        .filter(Boolean)
        .map((permissionId) => ({ role_id: role.id, permission_id: permissionId }))
    );
    if (rows.length) await admin.from('role_permissions').insert(rows);
    await logAuditEvent({
      admin,
      request,
      userId: user.id,
      action: 'role_permissions_updated',
      entityType: 'role',
      description: 'Restored permission presets for all system roles.',
      metadata: { roles: SYSTEM_ROLE_NAMES }
    });
    return Response.json({ success: true });
  }

  if (body.action === 'save_permissions') {
    const { roleId, permissionIds = [] } = body;
    const { data: role } = await admin.from('roles').select('*').eq('id', roleId).single();
    if (!role || role.name === 'super_admin') return Response.json({ error: 'This role permission set cannot be changed.' }, { status: 400 });
    await admin.from('role_permissions').delete().eq('role_id', roleId);
    if (permissionIds.length) await admin.from('role_permissions').insert(permissionIds.map((permissionId) => ({ role_id: roleId, permission_id: permissionId })));
    await logAuditEvent({ admin, request, userId: user.id, action: 'role_permissions_updated', entityType: 'role', entityId: roleId, description: `Updated permissions for ${role.display_name}.`, metadata: { permission_ids: permissionIds } });
    return Response.json({ success: true });
  }

  const { name, displayName, description = '' } = body;
  if (!name?.match(/^[a-z][a-z0-9_]*$/) || !displayName?.trim()) {
    return Response.json({ error: 'A valid role name and display name are required.' }, { status: 400 });
  }
  const { data: role, error } = await admin.from('roles').insert({ name, display_name: displayName.trim(), description, is_system_role: false }).select().single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  await logAuditEvent({ admin, request, userId: user.id, action: 'role_created', entityType: 'role', entityId: role.id, description: `Created custom role ${displayName}.` });
  return Response.json({ role }, { status: 201 });
}
