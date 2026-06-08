export async function canManageVillagePayments(supabase, userId, profileRole, villageId) {
  if (profileRole === 'super_admin') return true;
  if (!['accounting', 'village_admin'].includes(profileRole) || !villageId) return false;

  const { data } = await supabase
    .from('user_villages')
    .select('id')
    .eq('user_id', userId)
    .eq('village_id', villageId)
    .in('role', ['accounting', 'village_admin'])
    .maybeSingle();

  return Boolean(data);
}
