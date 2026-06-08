import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { claimGuestReservationsForUser } from '@/lib/reservations/claimGuestReservations';

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    if (data?.user) {
      try {
        await claimGuestReservationsForUser(data.user);
      } catch (error) {
        console.error('Could not claim guest reservations after email confirmation:', error);
      }
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(requestUrl.origin);
}
