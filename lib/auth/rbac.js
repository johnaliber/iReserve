import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { supabase, admin: null, user: null, profile: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return { supabase, admin: createAdminClient(), user, profile };
}

export async function hasPermission(admin, userId, permissionName) {
  if (!userId || !permissionName) return false;

  const { data, error } = await admin.rpc('has_permission', {
    p_user_id: userId,
    p_permission_name: permissionName
  });

  if (!error) return Boolean(data);

  const { data: profile } = await admin.from('profiles').select('role, status').eq('id', userId).single();
  return profile?.status !== 'suspended' && profile?.status !== 'inactive' && profile?.role === 'super_admin';
}

export async function hasRole(admin, userId, roleName) {
  const { data } = await admin.from('profiles').select('role, status').eq('id', userId).single();
  return data?.status === 'active' && data.role === roleName;
}

export async function hasScopeAccess(admin, userId, scopeType, villageId = null, propertyId = null) {
  const { data, error } = await admin.rpc('has_scope_access', {
    p_user_id: userId,
    p_scope_type: scopeType,
    p_village_id: villageId,
    p_property_id: propertyId
  });
  if (!error) return Boolean(data);
  return false;
}

export async function canAccessVillage(admin, userId, villageId) {
  if (!villageId) return false;
  return hasScopeAccess(admin, userId, 'village', villageId, null);
}

export async function canManageUser(admin, currentUserId, targetUserId) {
  const [{ data: current }, { data: target }] = await Promise.all([
    admin.from('profiles').select('role, status').eq('id', currentUserId).single(),
    admin.from('profiles').select('role').eq('id', targetUserId).single()
  ]);

  if (!current || current.status !== 'active' || !target) return false;
  if (current.role === 'super_admin') return currentUserId !== targetUserId || target.role === 'super_admin';
  if (current.role !== 'village_admin' || target.role === 'super_admin') return false;
  if (!await hasPermission(admin, currentUserId, 'users.update')) return false;

  const [{ data: currentScopes }, { data: targetScopes }] = await Promise.all([
    admin.from('user_access_scopes').select('village_id').eq('user_id', currentUserId).eq('scope_type', 'village'),
    admin.from('user_access_scopes').select('village_id').eq('user_id', targetUserId).eq('scope_type', 'village')
  ]);
  const allowed = new Set((currentScopes || []).map((scope) => scope.village_id));
  return (targetScopes || []).some((scope) => allowed.has(scope.village_id));
}

export async function requireApiPermission(permissionName) {
  const context = await getAuthContext();
  if (!context.user || !context.profile) {
    return { ...context, error: Response.json({ error: 'Authentication required.' }, { status: 401 }) };
  }
  if (context.profile.status !== 'active') {
    return { ...context, error: Response.json({ error: 'This account is not active.' }, { status: 403 }) };
  }
  if (!await hasPermission(context.admin, context.user.id, permissionName)) {
    return { ...context, error: Response.json({ error: 'You do not have the required permission.' }, { status: 403 }) };
  }
  return context;
}

export async function getUserVillageIds(admin, userId) {
  const { data: scopes } = await admin
    .from('user_access_scopes')
    .select('village_id')
    .eq('user_id', userId)
    .eq('scope_type', 'village');
  return (scopes || []).map((scope) => scope.village_id).filter(Boolean);
}
