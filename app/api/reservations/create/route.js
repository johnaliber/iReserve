import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createPaymentPlanForReservation, validatePaymentAmount } from '@/lib/payments/server';

export const dynamic = 'force-dynamic';

function json(status, payload) {
  return Response.json(payload, { status });
}

function reservationCode() {
  return `RES-${Math.random().toString(36).slice(2, 11).toUpperCase()}`;
}

function fallbackRef() {
  return `REF-${Math.floor(Math.random() * 1000000)}`;
}

export async function POST(request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const body = await request.json();

  const {
    propertyId,
    fullName,
    email,
    phone,
    paymentMethod,
    receiptRef,
    validIdUrl,
    incomeProofUrl,
    paymentType = 'partial_payment',
    downpaymentAmount,
    downpaymentPercentage = 20,
    installmentTermMonths,
    submittedAmount
  } = body || {};

  if (!propertyId || !fullName || !email || !paymentMethod || !paymentType) {
    return json(400, { error: 'Property, name, email, payment type, and payment method are required.' });
  }

  if (['partial_payment', 'installment'].includes(paymentType) && !downpaymentAmount && !downpaymentPercentage) {
    return json(400, { error: 'Downpayment amount or percentage is required for this payment type.' });
  }

  if (paymentType === 'installment' && !installmentTermMonths) {
    return json(400, { error: 'Installment term is required for installment payment.' });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile && profile.role !== 'customer') {
      return json(403, { error: 'Staff accounts are blocked from making property reservations.' });
    }
  }

  const { data: property, error: propertyError } = await admin
    .from('properties')
    .select('id, village_id, reservation_fee, status')
    .eq('id', propertyId)
    .single();

  if (propertyError || !property) {
    return json(404, { error: 'Property was not found.' });
  }

  if (property.status !== 'available') {
    return json(409, { error: 'This lot is no longer available for reservation.' });
  }

  const { data: lockedProperty, error: lockError } = await admin
    .from('properties')
    .update({ status: 'reserved', updated_at: new Date().toISOString() })
    .eq('id', propertyId)
    .eq('status', 'available')
    .select('id')
    .single();

  if (lockError || !lockedProperty) {
    return json(409, { error: 'This lot was just reserved by another customer.' });
  }

  const code = reservationCode();
  const reservationFee = property.reservation_fee || 5000;
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 48);

  try {
    const { data: reservation, error: reservationError } = await admin
      .from('reservations')
      .insert({
        reservation_code: code,
        village_id: property.village_id,
        property_id: property.id,
        customer_id: user?.id || null,
        guest_name: user ? null : fullName,
        guest_email: user ? null : email,
        guest_phone: user ? null : phone,
        status: 'pending_verification',
        reservation_fee: reservationFee,
        expires_at: expiresAt.toISOString(),
        reserved_at: new Date().toISOString()
      })
      .select()
      .single();

    if (reservationError) throw reservationError;

    const paymentPlan = await createPaymentPlanForReservation(admin, {
      reservationId: reservation.id,
      propertyId: property.id,
      customerId: user?.id || null,
      villageId: property.village_id,
      paymentType,
      downpaymentAmount,
      downpaymentPercentage,
      installmentTermMonths
    });

    const paymentPurpose = paymentType === 'full_payment' ? 'full_payment' : 'downpayment';
    const requestedAmount = submittedAmount || paymentPlan.initial_amount_due;
    const { maximumPayableAmount, amount } = await validatePaymentAmount(admin, {
      paymentPlanId: paymentPlan.id,
      submittedAmount: requestedAmount,
      paymentPurpose
    });

    const { error: paymentError } = await admin
      .from('payments')
      .insert({
        reservation_id: reservation.id,
        payment_plan_id: paymentPlan.id,
        village_id: property.village_id,
        customer_id: user?.id || null,
        amount,
        payment_method: paymentMethod,
        payment_status: 'pending_verification',
        payment_purpose: paymentPurpose,
        reference_number: receiptRef || fallbackRef(),
        proof_url: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&w=400&q=80',
        maximum_payable_amount: maximumPayableAmount,
        submitted_amount: amount,
        accepted_amount: amount,
        excess_amount: 0,
        is_overpayment: false,
        created_at: new Date().toISOString()
      });

    if (paymentError) throw paymentError;

    const docsPayload = [
      {
        reservation_id: reservation.id,
        customer_id: user?.id || null,
        document_type: 'Valid Government ID',
        file_url: validIdUrl,
        status: 'pending'
      },
      {
        reservation_id: reservation.id,
        customer_id: user?.id || null,
        document_type: 'Proof of Income',
        file_url: incomeProofUrl,
        status: 'pending'
      }
    ];

    const { error: docsError } = await admin.from('documents').insert(docsPayload);
    if (docsError) throw docsError;

    return json(200, { reservationCode: code, email });
  } catch (err) {
    await admin
      .from('properties')
      .update({ status: 'available', updated_at: new Date().toISOString() })
      .eq('id', propertyId);

    return json(400, { error: err.message || 'Reservation could not be completed.' });
  }
}
