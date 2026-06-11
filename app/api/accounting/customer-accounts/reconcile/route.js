import { canManageVillagePayments } from '@/lib/auth/canManageVillagePayments';
import { requireApiPermission } from '@/lib/auth/rbac';
import { ensureReservationPaymentPlan } from '@/lib/reservations/ensureReservationPaymentPlan';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  const context = await requireApiPermission('ledger.customer_accounts.view');
  if (context.error) return context.error;

  const { admin, profile, supabase, user } = context;
  const { villageId } = await request.json().catch(() => ({}));

  if (!villageId) {
    return Response.json({ error: 'Village is required.' }, { status: 400 });
  }

  if (!await canManageVillagePayments(supabase, user.id, profile.role, villageId)) {
    return Response.json({ error: 'You do not have ledger access to this village.' }, { status: 403 });
  }

  const { data: reservations, error: reservationsError } = await admin
    .from('reservations')
    .select('id, customer_id, village_id, property_id, payment_type, downpayment_amount, downpayment_percentage, installment_term_months, interest_rate')
    .eq('village_id', villageId)
    .not('customer_id', 'is', null);

  if (reservationsError) {
    return Response.json({ error: reservationsError.message }, { status: 400 });
  }

  const reservationIds = (reservations || []).map((reservation) => reservation.id);
  if (reservationIds.length === 0) return Response.json({ reconciled: 0 });

  const { data: plans, error: plansError } = await admin
    .from('payment_plans')
    .select('reservation_id')
    .in('reservation_id', reservationIds);

  if (plansError) {
    return Response.json({ error: plansError.message }, { status: 400 });
  }

  const reservationsWithPlans = new Set((plans || []).map((plan) => plan.reservation_id));
  const missingPlans = (reservations || []).filter(
    (reservation) => !reservationsWithPlans.has(reservation.id)
  );

  for (const reservation of missingPlans) {
    await ensureReservationPaymentPlan(admin, reservation, reservation.customer_id);
  }

  return Response.json({ reconciled: missingPlans.length });
}
