import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createNotification } from '@/lib/notifications/createNotification';

export const dynamic = 'force-dynamic';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'You must be signed in.' }, { status: 401 });

  const admin = createAdminClient();
  const result = await createNotification({
    admin,
    userId: user.id,
    title: 'Password Changed',
    message: 'Your iReserve password was changed successfully. Contact support immediately if you did not make this change.',
    type: 'password_changed',
    actionUrl: '/customer/account'
  });

  return Response.json({
    notificationCreated: Boolean(result.notification),
    emailSent: Boolean(result.email?.success)
  });
}
