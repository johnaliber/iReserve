import { getCurrentUser } from './getCurrentUser';
import { createClient } from '../supabase/server';
import { redirect } from 'next/navigation';

export async function requireVillageAccess(villageId, requiredVillageRole = null) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/login');
  }

  const userRole = user.profile?.role;

  // Super admin has global access to all villages automatically
  if (userRole === 'super_admin') {
    return user;
  }

  const supabase = await createClient();

  // Query the user_villages mapping
  let query = supabase
    .from('user_villages')
    .select('*')
    .eq('user_id', user.id)
    .eq('village_id', villageId);

  if (requiredVillageRole) {
    query = query.eq('role', requiredVillageRole);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    // If not mapped, deny access and redirect to home
    redirect('/');
  }

  return user;
}
