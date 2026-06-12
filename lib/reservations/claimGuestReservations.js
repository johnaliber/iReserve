import { createAdminClient } from '@/lib/supabase/admin';
import { ensureReservationPaymentPlan } from '@/lib/reservations/ensureReservationPaymentPlan';
import { createNotification } from '@/lib/notifications/createNotification';

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
    .select('id, customer_id, guest_email, village_id, property_id, payment_type, downpayment_amount, downpayment_percentage, installment_term_months, interest_rate')
    .or(`customer_id.is.null,customer_id.eq.${user.id}`)
    .not('guest_email', 'is', null);

  if (reservationLookupError) throw reservationLookupError;

  const reservationIds = (guestReservations || [])
    .filter((reservation) => normalizeEmail(reservation.guest_email) === email)
    .map((reservation) => reservation.id);

  if (reservationIds.length === 0) return { claimed: 0 };

  const reservationsToClaim = (guestReservations || [])
    .filter((reservation) => reservationIds.includes(reservation.id));
  const newlyClaimedReservations = reservationsToClaim.filter((reservation) => !reservation.customer_id);

  for (const reservation of reservationsToClaim) {
    await ensureReservationPaymentPlan(admin, reservation, user.id);
  }

  const updates = [
    admin.from('documents').update({ customer_id: user.id }).in('reservation_id', reservationIds).is('customer_id', null),
    admin.from('site_viewings').update({ customer_id: user.id }).in('reservation_id', reservationIds).is('customer_id', null)
  ];

  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;

  if (newlyClaimedReservations.length > 0) {
    await createNotification({
      admin,
      userId: user.id,
      title: 'Account Created and Reservation Linked',
      message: `${newlyClaimedReservations.length} reservation${newlyClaimedReservations.length === 1 ? ' was' : 's were'} linked to your new customer account.`,
      type: 'account_created',
      villageId: newlyClaimedReservations[0].village_id,
      metadata: { reservationId: newlyClaimedReservations[0].id },
      actionUrl: '/customer/dashboard'
    }).catch((notificationError) => {
      console.error('[notification] Claimed reservation account notification failed:', notificationError.message);
    });
  }

  return { claimed: newlyClaimedReservations.length };
}
