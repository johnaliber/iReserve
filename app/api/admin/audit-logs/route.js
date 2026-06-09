import { requireApiPermission, getUserVillageIds } from '@/lib/auth/rbac';

export const dynamic = 'force-dynamic';

export async function GET() {
  const context = await requireApiPermission('audit_logs.view');
  if (context.error) return context.error;
  const { admin, user, profile } = context;
  let query = admin
    .from('audit_logs')
    .select('*, profiles:user_id(full_name, email, role), villages(name)')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (profile.role === 'village_admin' || profile.role === 'accounting') {
    const villageIds = await getUserVillageIds(admin, user.id);
    if (!villageIds.length) return Response.json({ logs: [], villages: [], users: [] });
    query = query.in('village_id', villageIds);
  }

  const [{ data: logs, error }, { data: villages }, { data: users }] = await Promise.all([
    query,
    admin.from('villages').select('id, name').order('name'),
    admin.from('profiles').select('id, full_name, email, role').order('full_name')
  ]);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ logs: logs || [], villages: villages || [], users: users || [] });
}
