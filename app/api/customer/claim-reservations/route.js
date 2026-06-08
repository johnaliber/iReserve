import { claimGuestReservationsForUser } from '@/lib/reservations/claimGuestReservations';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return Response.json({ error: 'You must be signed in.' }, { status: 401 });
  }

  try {
    const result = await claimGuestReservationsForUser(user);
    return Response.json(result);
  } catch (claimError) {
    console.error('Guest reservation claim failed:', claimError);
    return Response.json(
      { error: 'Your guest reservation could not be linked yet.' },
      { status: 500 }
    );
  }
}
