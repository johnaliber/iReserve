import { createAdminClient } from '@/lib/supabase/admin';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export async function claimGuestReservationsForUser(user) {
  const email = normalizeEmail(user?.email);
  if (!user?.id || !email) return { claimed: 0 };

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError) throw profileError;
  if (profile?.role !== 'customer') return { claimed: 0 };

  const { data: guestReservations, error: reservationLookupError } = await admin
    .from('reservations')
    .select('id, guest_email')
    .is('customer_id', null)
    .not('guest_email', 'is', null);

  if (reservationLookupError) throw reservationLookupError;

  const reservationIds = (guestReservations || [])
    .filter((reservation) => normalizeEmail(reservation.guest_email) === email)
    .map((reservation) => reservation.id);

  if (reservationIds.length === 0) return { claimed: 0 };

  const updates = [
    admin.from('reservations').update({ customer_id: user.id }).in('id', reservationIds).is('customer_id', null),
    admin.from('payment_plans').update({ customer_id: user.id }).in('reservation_id', reservationIds).is('customer_id', null),
    admin.from('payments').update({ customer_id: user.id }).in('reservation_id', reservationIds).is('customer_id', null),
    admin.from('documents').update({ customer_id: user.id }).in('reservation_id', reservationIds).is('customer_id', null),
    admin.from('site_viewings').update({ customer_id: user.id }).in('reservation_id', reservationIds).is('customer_id', null)
  ];

  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;

  return { claimed: reservationIds.length };
}
