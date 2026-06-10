import UserManagementPage from '@/components/admin/UserManagementPage';

const ALLOWED_ROLES = new Set(['super_admin', 'village_admin', 'accounting', 'architect', 'customer', 'guest']);

export default async function SuperAdminUsersPage({ searchParams }) {
  const query = await searchParams;
  const requestedRole = typeof query.role === 'string' ? query.role : '';
  const roleFilter = ALLOWED_ROLES.has(requestedRole) ? requestedRole : '';

  return <UserManagementPage key={roleFilter || 'all'} initialRoleFilter={roleFilter} />;
}
