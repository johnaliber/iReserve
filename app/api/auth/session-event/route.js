import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAuditEvent } from '@/lib/audit/logAuditEvent';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Authentication required.' }, { status: 401 });

  const admin = createAdminClient();
  const now = new Date().toISOString();
  await admin.from('profiles').update({ last_login_at: now, updated_at: now }).eq('id', user.id);
  await logAuditEvent({
    admin,
    request,
    userId: user.id,
    action: 'user_logged_in',
    entityType: 'authentication',
    entityId: user.id,
    description: 'User signed in successfully.'
  });

  return Response.json({ success: true });
}
