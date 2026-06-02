import { getCurrentUser } from './getCurrentUser';
import { redirect } from 'next/navigation';

export async function requireRole(allowedRoles) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/login');
  }

  const role = user.profile?.role;
  const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  // Super admins are always allowed everywhere
  if (role === 'super_admin') {
    return user;
  }

  if (!rolesArray.includes(role)) {
    redirect('/');
  }

  return user;
}
