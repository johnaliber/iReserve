import { createPaymentPlanForReservation, recalculatePaymentIndicators } from '@/lib/payments/server';

export async function ensureReservationPaymentPlan(admin, reservation, customerId) {
  if (!reservation?.id || !reservation?.property_id || !reservation?.village_id || !customerId) {
    throw new Error('Reservation, property, village, and customer are required to create a payment plan.');
  }

  const { data: existingPlans, error: planLookupError } = await admin
    .from('payment_plans')
    .select('id')
    .eq('reservation_id', reservation.id)
    .order('created_at', { ascending: true })
    .limit(1);

  if (planLookupError) throw planLookupError;

  let paymentPlanId = existingPlans?.[0]?.id || null;
  if (!paymentPlanId) {
    const paymentPlan = await createPaymentPlanForReservation(admin, {
      reservationId: reservation.id,
      propertyId: reservation.property_id,
      customerId,
      villageId: reservation.village_id,
      paymentType: reservation.payment_type || 'partial_payment',
      downpaymentAmount: reservation.downpayment_amount,
      downpaymentPercentage: reservation.downpayment_percentage,
      installmentTermMonths: reservation.installment_term_months,
      interestRate: reservation.interest_rate
    });
    paymentPlanId = paymentPlan.id;
  }

  const { error: planCustomerError } = await admin
    .from('payment_plans')
    .update({ customer_id: customerId })
    .eq('id', paymentPlanId);

  if (planCustomerError) throw planCustomerError;

  const { error: paymentLinkError } = await admin
    .from('payments')
    .update({
      customer_id: customerId,
      payment_plan_id: paymentPlanId
    })
    .eq('reservation_id', reservation.id);

  if (paymentLinkError) throw paymentLinkError;

  const { error: reservationLinkError } = await admin
    .from('reservations')
    .update({ customer_id: customerId })
    .eq('id', reservation.id);

  if (reservationLinkError) throw reservationLinkError;

  await recalculatePaymentIndicators(admin, paymentPlanId);
  return paymentPlanId;
}
