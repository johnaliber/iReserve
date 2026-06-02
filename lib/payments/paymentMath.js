export const PAYMENT_TYPES = {
  full_payment: 'Full Payment',
  partial_payment: 'Partial Payment / Downpayment',
  installment: 'Installment Payment'
};

export const PAYMENT_PURPOSES = {
  reservation_fee: 'Reservation Fee',
  downpayment: 'Downpayment',
  full_payment: 'Full Payment',
  monthly_installment: 'Monthly Installment',
  partial_balance_payment: 'Balance Payment',
  refund: 'Refund'
};

export function toMoneyNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function roundMoney(value) {
  return Math.round(toMoneyNumber(value) * 100) / 100;
}

export function formatPeso(value) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(toMoneyNumber(value));
}

export function calculatePaymentPlan({
  propertyPrice,
  reservationFee,
  paymentType = 'partial_payment',
  downpaymentAmount,
  downpaymentPercentage,
  installmentTermMonths,
  interestRate = 0
}) {
  const totalContractPrice = roundMoney(propertyPrice);
  const holdFee = roundMoney(reservationFee);
  const downpayment = downpaymentAmount !== undefined && downpaymentAmount !== ''
    ? roundMoney(downpaymentAmount)
    : roundMoney(totalContractPrice * (toMoneyNumber(downpaymentPercentage) / 100));

  if (paymentType === 'full_payment') {
    return {
      paymentType,
      totalContractPrice,
      reservationFee: holdFee,
      downpaymentAmount: 0,
      downpaymentPercentage: 0,
      initialAmountDue: totalContractPrice,
      principalBalance: totalContractPrice,
      remainingBalance: totalContractPrice,
      installmentTermMonths: null,
      monthlyPayment: null,
      interestRate: roundMoney(interestRate),
      status: 'pending_initial_payment'
    };
  }

  const initialAmountDue = roundMoney(holdFee + downpayment);

  if (paymentType === 'installment') {
    const term = Math.max(1, Number.parseInt(installmentTermMonths, 10) || 12);
    const principalBalance = roundMoney(Math.max(0, totalContractPrice - initialAmountDue));
    return {
      paymentType,
      totalContractPrice,
      reservationFee: holdFee,
      downpaymentAmount: downpayment,
      downpaymentPercentage: toMoneyNumber(downpaymentPercentage),
      initialAmountDue,
      principalBalance,
      remainingBalance: totalContractPrice,
      installmentTermMonths: term,
      monthlyPayment: roundMoney(principalBalance / term),
      interestRate: roundMoney(interestRate),
      status: 'pending_initial_payment'
    };
  }

  return {
    paymentType: 'partial_payment',
    totalContractPrice,
    reservationFee: holdFee,
    downpaymentAmount: downpayment,
    downpaymentPercentage: toMoneyNumber(downpaymentPercentage),
    initialAmountDue,
    principalBalance: totalContractPrice,
    remainingBalance: totalContractPrice,
    installmentTermMonths: null,
    monthlyPayment: null,
    interestRate: roundMoney(interestRate),
    status: 'pending_initial_payment'
  };
}

export function getPaymentAmountIndicator({
  amountPaid,
  totalContractPrice,
  initialAmountDue,
  overdueCount = 0
}) {
  const paid = toMoneyNumber(amountPaid);
  const total = toMoneyNumber(totalContractPrice);
  const initial = toMoneyNumber(initialAmountDue);

  if (paid > total && total > 0) return 'overpaid';
  if (paid >= total && total > 0) return 'fully_paid';
  if (overdueCount > 0) return 'overdue';
  if (paid <= 0) return 'not_paid';
  if (paid < initial) return 'insufficient_payment';
  if (paid >= initial && paid < total) return 'partially_paid';
  return 'not_paid';
}

export function calculateIndicatorSummary({
  amountPaid,
  totalContractPrice,
  initialAmountDue,
  overdueCount = 0
}) {
  const paid = roundMoney(amountPaid);
  const total = roundMoney(totalContractPrice);
  const initial = roundMoney(initialAmountDue);
  const remainingBalance = roundMoney(Math.max(0, total - paid));
  const totalPaymentProgress = total > 0 ? Math.min(100, roundMoney((paid / total) * 100)) : 0;
  const initialPaymentProgress = initial > 0 ? Math.min(100, roundMoney((paid / initial) * 100)) : 0;

  return {
    amountPaid: paid,
    remainingBalance,
    initialPaymentProgress,
    totalPaymentProgress,
    paymentAmountIndicator: getPaymentAmountIndicator({
      amountPaid: paid,
      totalContractPrice: total,
      initialAmountDue: initial,
      overdueCount
    })
  };
}

export function getMaximumPayableAmount({
  paymentType,
  paymentPurpose,
  totalContractPrice,
  initialAmountDue,
  amountPaid,
  remainingBalance,
  scheduleAmountDue,
  scheduleAmountPaid
}) {
  if (paymentPurpose === 'monthly_installment') {
    return roundMoney(Math.max(0, toMoneyNumber(scheduleAmountDue) - toMoneyNumber(scheduleAmountPaid)));
  }

  if (paymentType === 'partial_payment' && paymentPurpose === 'downpayment') {
    return roundMoney(Math.max(0, toMoneyNumber(initialAmountDue) - toMoneyNumber(amountPaid)));
  }

  if (paymentType === 'installment' && ['reservation_fee', 'downpayment'].includes(paymentPurpose)) {
    return roundMoney(Math.max(0, toMoneyNumber(initialAmountDue) - toMoneyNumber(amountPaid)));
  }

  if (paymentType === 'full_payment') {
    const remaining = remainingBalance !== undefined && remainingBalance !== null
      ? toMoneyNumber(remainingBalance)
      : toMoneyNumber(totalContractPrice) - toMoneyNumber(amountPaid);
    return roundMoney(Math.max(0, remaining));
  }

  return roundMoney(Math.max(0, toMoneyNumber(remainingBalance)));
}
