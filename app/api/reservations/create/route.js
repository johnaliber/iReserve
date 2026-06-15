import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createPaymentPlanForReservation, validatePaymentAmount } from '@/lib/payments/server';
import {
  calculatePaymentPlan,
  getAmountDueForReservationStart,
  getInterestRateForTerm,
  roundMoney
} from '@/lib/payments/paymentMath';
import { logAuditEvent } from '@/lib/audit/logAuditEvent';
import {
  getAccountingRecipients,
  getSuperAdminRecipients,
  getVillageAdminRecipients
} from '@/lib/email/getNotificationRecipients';
import { sendEmail } from '@/lib/email/sendEmail';
import { notificationEmail } from '@/lib/email/templates/notificationEmail';
import { createNotification, createNotifications } from '@/lib/notifications/createNotification';
import {
  reservationFileUrl,
  validateReservationFileReference
} from '@/lib/storage/reservationFiles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
    address,
    paymentMethod,
    receiptRef,
    receiptFile,
    validIdFile,
    incomeProofFile,
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

  let reservationFullName = String(fullName || '').trim();
  let reservationEmail = String(email || '').trim().toLowerCase();
  let reservationPhone = String(phone || '').trim();
  let customerProfileUpdates = null;

  if (user) {
    let { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      return json(400, { error: 'Your customer profile could not be loaded. Please refresh and try again.' });
    }

    if (!profile) {
      const accountRole = user.app_metadata?.role || user.user_metadata?.role || 'customer';
      if (accountRole !== 'customer') {
        return json(403, { error: 'Staff accounts are blocked from making property reservations.' });
      }

      const { data: recoveredProfile, error: recoveryError } = await admin
        .from('profiles')
        .insert({
          id: user.id,
          full_name: reservationFullName || user.user_metadata?.full_name || 'Valued Customer',
          email: String(user.email || reservationEmail).trim().toLowerCase(),
          phone: reservationPhone || user.user_metadata?.phone || null,
          role: 'customer'
        })
        .select('*')
        .single();

      if (recoveryError || !recoveredProfile) {
        return json(400, {
          error: 'Your customer profile could not be restored. Please sign out, sign in again, and retry.'
        });
      }

      profile = recoveredProfile;
    }

    if (profile.role !== 'customer') {
      return json(403, { error: 'Staff accounts are blocked from making property reservations.' });
    }
    if (profile.status && profile.status !== 'active') {
      return json(403, { error: 'This customer account is not active.' });
    }

    reservationEmail = String(user.email || profile.email || '').trim().toLowerCase();
    reservationFullName = reservationFullName || profile.full_name;
    reservationPhone = reservationPhone || profile.phone || '';

    customerProfileUpdates = {
      full_name: reservationFullName,
      phone: reservationPhone,
      updated_at: new Date().toISOString()
    };
    if (Object.prototype.hasOwnProperty.call(profile, 'address')) {
      customerProfileUpdates.address = String(address || profile.address || '').trim();
    }
  } else {
    const { data: existingProfile, error: existingProfileError } = await admin
      .from('profiles')
      .select('id')
      .ilike('email', reservationEmail)
      .maybeSingle();

    if (existingProfileError) {
      return json(400, { error: 'The reservation email could not be verified.' });
    }
    if (existingProfile) {
      return json(409, {
        error: 'An account already exists with this email. Please log in to continue your reservation.'
      });
    }
  }

  let validIdReference;
  let incomeProofReference;
  let receiptReference = null;
  try {
    validIdReference = validateReservationFileReference('validId', validIdFile);
    incomeProofReference = validateReservationFileReference('incomeProof', incomeProofFile);
    if (receiptFile) {
      receiptReference = validateReservationFileReference('receipt', receiptFile);
    }

    const references = [validIdReference, incomeProofReference, receiptReference].filter(Boolean);
    const checks = await Promise.all(references.map((reference) => (
      admin.storage.from(reference.bucket).info(reference.path)
    )));
    if (checks.some(({ error }) => error)) {
      return json(400, { error: 'One or more uploaded files could not be verified.' });
    }
  } catch (err) {
    return json(400, { error: err.message || 'Documents could not be verified.' });
  }

  const savedValidIdUrl = reservationFileUrl(
    validIdReference.bucket,
    validIdReference.path,
    validIdReference.accessToken
  );
  const savedIncomeProofUrl = reservationFileUrl(
    incomeProofReference.bucket,
    incomeProofReference.path,
    incomeProofReference.accessToken
  );
  const savedReceiptUrl = receiptReference
    ? reservationFileUrl(receiptReference.bucket, receiptReference.path, receiptReference.accessToken)
    : '';

  const { data: property, error: propertyError } = await admin
    .from('properties')
    .select('id, village_id, price, reservation_fee, interest_rate, status')
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
  const isGuest = !user;
  const preferredPlan = calculatePaymentPlan({
    propertyPrice: property.price,
    reservationFee,
    paymentType,
    downpaymentAmount,
    downpaymentPercentage,
    installmentTermMonths,
    interestRate: getInterestRateForTerm(property.interest_rate, Number(installmentTermMonths || 0) / 12)
  });
  const amountDueToday = getAmountDueForReservationStart({
    isAuthenticated: !isGuest,
    propertyPrice: property.price,
    reservationFee,
    paymentType,
    requiredDownpayment: preferredPlan.requiredDownpayment,
    remainingDownpayment: preferredPlan.remainingDownpayment,
    fullPaymentAmount: preferredPlan.totalContractPrice
  });
  const requestedAmount = roundMoney(submittedAmount || amountDueToday);

  if (requestedAmount !== amountDueToday) {
    await admin
      .from('properties')
      .update({ status: 'available', updated_at: new Date().toISOString() })
      .eq('id', propertyId);

    return json(400, {
      error: isGuest && requestedAmount > reservationFee
        ? 'Please create an account first before paying more than the reservation fee.'
        : `The submitted payment must equal the amount due today: ${amountDueToday}.`
    });
  }
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 48);
  let createdReservationId = null;

  try {
    const { data: reservation, error: reservationError } = await admin
      .from('reservations')
      .insert({
        reservation_code: code,
        village_id: property.village_id,
        property_id: property.id,
        customer_id: user?.id || null,
        guest_name: user ? null : reservationFullName,
        guest_email: user ? null : reservationEmail,
        guest_phone: user ? null : reservationPhone,
        status: 'pending_verification',
        reservation_fee: reservationFee,
        payment_type: preferredPlan.paymentType,
        total_contract_price: preferredPlan.totalContractPrice,
        downpayment_amount: preferredPlan.downpaymentAmount,
        downpayment_percentage: preferredPlan.downpaymentPercentage,
        initial_amount_due: isGuest ? reservationFee : preferredPlan.initialAmountDue,
        amount_due_today: amountDueToday,
        amount_paid: 0,
        remaining_balance: preferredPlan.remainingBalance,
        installment_term_months: preferredPlan.installmentTermMonths,
        monthly_payment: preferredPlan.monthlyPayment,
        interest_rate: preferredPlan.interestRate,
        payment_plan_status: isGuest ? 'not_started' : preferredPlan.status,
        payment_amount_indicator: 'not_paid',
        expires_at: expiresAt.toISOString(),
        reserved_at: new Date().toISOString()
      })
      .select()
      .single();

    if (reservationError) throw reservationError;
    createdReservationId = reservation.id;

    let paymentPlan = null;
    let maximumPayableAmount = amountDueToday;
    let amount = requestedAmount;
    let paymentPurpose = 'reservation_fee';

    if (!isGuest) {
      paymentPlan = await createPaymentPlanForReservation(admin, {
        reservationId: reservation.id,
        propertyId: property.id,
        customerId: user.id,
        villageId: property.village_id,
        paymentType,
        downpaymentAmount,
        downpaymentPercentage,
        installmentTermMonths
      });

      paymentPurpose = paymentType === 'full_payment' ? 'full_payment' : 'downpayment';
      const validation = await validatePaymentAmount(admin, {
        paymentPlanId: paymentPlan.id,
        submittedAmount: requestedAmount,
        paymentPurpose
      });
      maximumPayableAmount = validation.maximumPayableAmount;
      amount = validation.amount;
    }

    const { data: payment, error: paymentError } = await admin
      .from('payments')
      .insert({
        reservation_id: reservation.id,
        payment_plan_id: paymentPlan?.id || null,
        village_id: property.village_id,
        customer_id: user?.id || null,
        amount,
        payment_method: paymentMethod,
        payment_status: 'pending_verification',
        payment_purpose: paymentPurpose,
        reference_number: receiptRef || fallbackRef(),
        proof_url: savedReceiptUrl || 'QR payment submitted with transaction reference',
        maximum_payable_amount: maximumPayableAmount,
        submitted_amount: amount,
        accepted_amount: amount,
        excess_amount: 0,
        is_overpayment: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (paymentError) throw paymentError;

    const docsPayload = [
      {
        reservation_id: reservation.id,
        customer_id: user?.id || null,
        document_type: 'Valid Government ID',
        file_url: savedValidIdUrl,
        status: 'pending'
      },
      {
        reservation_id: reservation.id,
        customer_id: user?.id || null,
        document_type: 'Proof of Income',
        file_url: savedIncomeProofUrl,
        status: 'pending'
      }
    ];

    const { error: docsError } = await admin.from('documents').insert(docsPayload);
    if (docsError) throw docsError;

    if (user && customerProfileUpdates) {
      const { error: profileUpdateError } = await admin
        .from('profiles')
        .update(customerProfileUpdates)
        .eq('id', user.id);

      if (profileUpdateError) {
        throw new Error('Your contact details could not be updated safely.');
      }
    }

    await Promise.all([
      logAuditEvent({
        admin,
        request,
        userId: user?.id || null,
        villageId: property.village_id,
        action: 'reservation_created',
        entityType: 'reservation',
        entityId: reservation.id,
        description: `Created reservation ${code}.`,
        metadata: { property_id: property.id, payment_type: paymentType }
      }),
      logAuditEvent({
        admin,
        request,
        userId: user?.id || null,
        villageId: property.village_id,
        action: 'payment_uploaded',
        entityType: 'reservation',
        entityId: reservation.id,
        description: `Submitted the initial payment for reservation ${code}.`,
        metadata: { payment_method: paymentMethod, payment_purpose: paymentPurpose }
      }),
      logAuditEvent({
        admin,
        request,
        userId: user?.id || null,
        villageId: property.village_id,
        action: 'document_uploaded',
        entityType: 'reservation',
        entityId: reservation.id,
        description: `Uploaded required documents for reservation ${code}.`,
        metadata: { document_types: docsPayload.map((document) => document.document_type) }
      })
    ]);

    const customerMessage = `Reservation ${code} was created and is pending review. Your ${paymentPurpose.replaceAll('_', ' ')} payment of PHP ${amount.toLocaleString('en-PH')} is under review.`;
    if (user) {
      await createNotification({
        admin,
        userId: user.id,
        title: 'Reservation Submitted',
        message: customerMessage,
        type: 'reservation_pending',
        villageId: property.village_id,
        metadata: { reservationId: reservation.id, paymentId: payment.id },
        actionUrl: '/customer/reservations'
      }).catch((notificationError) => {
        console.error('[notification] Customer reservation notification failed:', notificationError.message);
      });
    } else {
      const emailContent = notificationEmail({
        title: 'Reservation Submitted',
        message: customerMessage,
        type: 'reservation_pending',
        userName: reservationFullName,
        actionUrl: `/auth/register?email=${encodeURIComponent(reservationEmail)}`,
        actionLabel: 'Verify Account',
        actionHelpText: 'Create your iReserve account, then use the verification email sent to this address to activate it.'
      });
      await sendEmail({
        to: reservationEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      });
    }

    const [villageAdmins, accountingUsers, superAdmins] = await Promise.all([
      getVillageAdminRecipients(admin, property.village_id),
      getAccountingRecipients(admin),
      getSuperAdminRecipients(admin)
    ]);
    await createNotifications({
      admin,
      recipients: [...villageAdmins, ...accountingUsers, ...superAdmins],
      title: 'New Reservation Submitted',
      message: `${reservationFullName} submitted reservation ${code} with a ${paymentPurpose.replaceAll('_', ' ')} payment awaiting review.`,
      type: 'reservation_created_admin',
      villageId: property.village_id,
      metadata: { reservationId: reservation.id, paymentId: payment.id },
      actionUrl: '/village-admin/reservations'
    });

    return json(200, { reservationCode: code, email: reservationEmail, isGuest });
  } catch (err) {
    if (createdReservationId) {
      const { error: cleanupError } = await admin
        .from('reservations')
        .delete()
        .eq('id', createdReservationId);

      if (cleanupError) {
        console.error('Incomplete reservation cleanup failed:', cleanupError);
      }
    }

    await admin
      .from('properties')
      .update({ status: 'available', updated_at: new Date().toISOString() })
      .eq('id', propertyId);

    return json(400, { error: err.message || 'Reservation could not be completed.' });
  }
}
