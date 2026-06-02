export async function getManageableVillages(supabase, userId) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  const { data: uv } = await supabase
    .from('user_villages')
    .select('*, villages(*)')
    .eq('user_id', userId);

  let villages = (uv || []).map((item) => item.villages).filter(Boolean);

  if (profile?.role === 'super_admin') {
    const { data } = await supabase
      .from('villages')
      .select('*')
      .eq('status', 'active')
      .order('name', { ascending: true });

    villages = data || [];
  }

  return villages;
}
