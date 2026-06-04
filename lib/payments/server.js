import { calculateIndicatorSummary, calculatePaymentPlan, getMaximumPayableAmount, roundMoney } from './paymentMath';

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function sameNumber(left, right) {
  return Number(left || 0) === Number(right || 0);
}

function resolvePresetInterestRate(property, presets = []) {
  if (Number(property?.interest_rate || 0) > 0) return Number(property.interest_rate);

  const normalizedModel = String(property?.model_name || '').trim().toLowerCase();
  const byName = presets.find((preset) => {
    const presetModel = String(preset.model_name || preset.name || '').trim().toLowerCase();
    return normalizedModel && presetModel === normalizedModel;
  });
  if (byName) return Number(byName.interest_rate || 0);

  const bySpecs = presets.find((preset) => (
    property.property_type === preset.property_type &&
    sameNumber(property.price, preset.price) &&
    sameNumber(property.reservation_fee, preset.reservation_fee) &&
    sameNumber(property.lot_size, preset.lot_size) &&
    sameNumber(property.floor_area, preset.floor_area) &&
    sameNumber(property.bedrooms, preset.bedrooms) &&
    sameNumber(property.bathrooms, preset.bathrooms) &&
    sameNumber(property.parking_slots, preset.parking_slots)
  ));

  return Number(bySpecs?.interest_rate || 0);
}

export async function createPaymentPlanForReservation(admin, {
  reservationId,
  propertyId,
  customerId,
  villageId,
  paymentType,
  downpaymentAmount,
  downpaymentPercentage,
  installmentTermMonths,
  interestRate = 0
}) {
  const { data: property, error: propertyError } = await admin
    .from('properties')
    .select('village_id, property_type, model_name, price, reservation_fee, interest_rate, lot_size, floor_area, bedrooms, bathrooms, parking_slots')
    .eq('id', propertyId)
    .single();

  if (propertyError || !property) {
    throw new Error(propertyError?.message || 'Property not found for payment plan.');
  }

  let resolvedInterestRate = Number(interestRate || property.interest_rate || 0);
  if (resolvedInterestRate === 0) {
    const { data: presets } = await admin
      .from('property_type_presets')
      .select('name, model_name, property_type, price, reservation_fee, interest_rate, lot_size, floor_area, bedrooms, bathrooms, parking_slots')
      .eq('village_id', property.village_id)
      .eq('is_active', true);

    resolvedInterestRate = resolvePresetInterestRate(property, presets || []);
  }

  const plan = calculatePaymentPlan({
    propertyPrice: property.price,
    reservationFee: property.reservation_fee,
    paymentType,
    downpaymentAmount,
    downpaymentPercentage,
    installmentTermMonths,
    interestRate: resolvedInterestRate
  });

  const startDate = new Date();
  const nextDueDate = plan.paymentType === 'installment' ? addMonths(startDate, 1) : null;

  const { data: paymentPlan, error: planError } = await admin
    .from('payment_plans')
    .insert({
      reservation_id: reservationId,
      customer_id: customerId || null,
      village_id: villageId,
      property_id: propertyId,
      payment_type: plan.paymentType,
      total_contract_price: plan.totalContractPrice,
      reservation_fee: plan.reservationFee,
      downpayment_amount: plan.downpaymentAmount,
      downpayment_percentage: plan.downpaymentPercentage,
      initial_amount_due: plan.initialAmountDue,
      principal_balance: plan.principalBalance,
      amount_paid: 0,
      remaining_balance: plan.remainingBalance,
      installment_term_months: plan.installmentTermMonths,
      monthly_payment: plan.monthlyPayment,
      interest_rate: plan.interestRate,
      start_date: startDate.toISOString().slice(0, 10),
      next_due_date: nextDueDate ? nextDueDate.toISOString().slice(0, 10) : null,
      status: plan.status,
      initial_payment_progress: 0,
      total_payment_progress: 0,
      payment_amount_indicator: 'not_paid',
      overdue_count: 0
    })
    .select()
    .single();

  if (planError || !paymentPlan) {
    throw new Error(planError?.message || 'Payment plan could not be created.');
  }

  if (plan.paymentType === 'installment') {
    const rows = Array.from({ length: plan.installmentTermMonths }, (_, index) => {
      const dueDate = addMonths(startDate, index + 1).toISOString().slice(0, 10);
      return {
        payment_plan_id: paymentPlan.id,
        reservation_id: reservationId,
        due_number: index + 1,
        due_date: dueDate,
        amount_due: plan.monthlyPayment,
        amount_paid: 0,
        remaining_due: plan.monthlyPayment,
        status: 'unpaid'
      };
    });

    const { error: scheduleError } = await admin.from('payment_schedule').insert(rows);
    if (scheduleError) throw scheduleError;
  }

  await admin
    .from('reservations')
    .update({
      payment_type: plan.paymentType,
      total_contract_price: plan.totalContractPrice,
      downpayment_amount: plan.downpaymentAmount,
      downpayment_percentage: plan.downpaymentPercentage,
      initial_amount_due: plan.initialAmountDue,
      amount_paid: 0,
      remaining_balance: plan.remainingBalance,
      installment_term_months: plan.installmentTermMonths,
      monthly_payment: plan.monthlyPayment,
      next_due_date: nextDueDate ? nextDueDate.toISOString().slice(0, 10) : null,
      payment_plan_status: plan.status,
      payment_amount_indicator: 'not_paid'
    })
    .eq('id', reservationId);

  return paymentPlan;
}

export async function recalculatePaymentIndicators(admin, paymentPlanId) {
  const { data: paymentPlan, error: planError } = await admin
    .from('payment_plans')
    .select('*')
    .eq('id', paymentPlanId)
    .single();

  if (planError || !paymentPlan) {
    throw new Error(planError?.message || 'Payment plan not found.');
  }

  const { data: verifiedPayments } = await admin
    .from('payments')
    .select('*')
    .eq('payment_plan_id', paymentPlanId)
    .eq('payment_status', 'verified');

  const { data: scheduleRows } = await admin
    .from('payment_schedule')
    .select('*')
    .eq('payment_plan_id', paymentPlanId)
    .order('due_number', { ascending: true });

  const amountPaid = roundMoney((verifiedPayments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
  const today = new Date().toISOString().slice(0, 10);
  const overdueRows = (scheduleRows || []).filter((row) => row.due_date < today && ['unpaid', 'partially_paid'].includes(row.status));
  const nextDue = (scheduleRows || []).find((row) => ['unpaid', 'partially_paid', 'overdue'].includes(row.status));
  const lastPayment = (verifiedPayments || []).sort((a, b) => new Date(b.verified_at || b.created_at) - new Date(a.verified_at || a.created_at))[0];
  const summary = calculateIndicatorSummary({
    amountPaid,
    totalContractPrice: paymentPlan.total_contract_price,
    initialAmountDue: paymentPlan.initial_amount_due,
    overdueCount: overdueRows.length
  });

  let status = paymentPlan.status;
  if (summary.paymentAmountIndicator === 'fully_paid') status = 'fully_paid';
  else if (summary.paymentAmountIndicator === 'overdue') status = 'overdue';
  else if (amountPaid >= Number(paymentPlan.initial_amount_due || 0) && paymentPlan.payment_type !== 'full_payment') {
    status = paymentPlan.payment_type === 'partial_payment' ? 'downpayment_completed' : 'active';
  } else if (amountPaid > 0) {
    status = 'pending_initial_payment';
  }

  const updatePayload = {
    amount_paid: summary.amountPaid,
    remaining_balance: summary.remainingBalance,
    initial_payment_progress: summary.initialPaymentProgress,
    total_payment_progress: summary.totalPaymentProgress,
    payment_amount_indicator: summary.paymentAmountIndicator,
    overdue_count: overdueRows.length,
    next_due_date: nextDue?.due_date || null,
    last_payment_date: lastPayment?.verified_at || lastPayment?.created_at || null,
    status,
    updated_at: new Date().toISOString()
  };

  const { data: updatedPlan, error: updateError } = await admin
    .from('payment_plans')
    .update(updatePayload)
    .eq('id', paymentPlanId)
    .select()
    .single();

  if (updateError) throw updateError;

  await admin
    .from('reservations')
    .update({
      amount_paid: summary.amountPaid,
      remaining_balance: summary.remainingBalance,
      payment_plan_status: status,
      payment_amount_indicator: summary.paymentAmountIndicator,
      next_due_date: updatePayload.next_due_date
    })
    .eq('id', paymentPlan.reservation_id);

  return updatedPlan;
}

export async function validatePaymentAmount(admin, {
  paymentPlanId,
  paymentScheduleId,
  submittedAmount,
  paymentPurpose
}) {
  const { data: plan, error: planError } = await admin
    .from('payment_plans')
    .select('*')
    .eq('id', paymentPlanId)
    .single();

  if (planError || !plan) throw new Error('Payment plan not found.');

  let schedule = null;
  if (paymentScheduleId) {
    const { data } = await admin
      .from('payment_schedule')
      .select('*')
      .eq('id', paymentScheduleId)
      .single();
    schedule = data;
  }

  const maximumPayableAmount = getMaximumPayableAmount({
    paymentType: plan.payment_type,
    paymentPurpose,
    totalContractPrice: plan.total_contract_price,
    initialAmountDue: plan.initial_amount_due,
    amountPaid: plan.amount_paid,
    remainingBalance: plan.remaining_balance,
    scheduleAmountDue: schedule?.amount_due,
    scheduleAmountPaid: schedule?.amount_paid
  });

  const amount = roundMoney(submittedAmount);
  if (amount <= 0) {
    throw new Error('Invalid payment amount. The amount must be greater than zero.');
  }
  if (amount > maximumPayableAmount) {
    throw new Error('Invalid payment amount. The amount entered exceeds the current amount due.');
  }

  return { plan, schedule, maximumPayableAmount, amount };
}
