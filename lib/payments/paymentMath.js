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

export function getInterestRateForTerm(baseRate, termYears) {
  // If the property has 0% in the DB, fallback to a standard 7.0% base rate
  // so the dynamic computation works for unconfigured properties
  const base = Number(baseRate || 0) || 7.0;

  const multipliers = {
    5: 0.6,   // 40 % discount for 5-year term
    10: 0.8,  // 20 % discount for 10-year term
    15: 1.0,  // base rate for 15-year term (default)
    20: 1.2   // 20 % premium for 20-year term
  };

  const multiplier = multipliers[termYears] ?? 1.0;
  return Math.round(base * multiplier * 100) / 100;
}

export function calculateAmortizedMonthlyPayment({
  principal,
  annualInterestRate = 0,
  termMonths
}) {
  const financedPrincipal = roundMoney(Math.max(0, toMoneyNumber(principal)));
  const term = Math.max(1, Number.parseInt(termMonths, 10) || 1);
  const monthlyRate = Math.max(0, toMoneyNumber(annualInterestRate)) / 100 / 12;

  if (financedPrincipal === 0) return 0;
  if (monthlyRate === 0) return roundMoney(financedPrincipal / term);

  const compoundFactor = Math.pow(1 + monthlyRate, term);
  return roundMoney(
    financedPrincipal * ((monthlyRate * compoundFactor) / (compoundFactor - 1))
  );
}

function calculateAmortizedPaymentDetails({
  principal,
  annualInterestRate = 0,
  termMonths
}) {
  const financedPrincipal = roundMoney(Math.max(0, toMoneyNumber(principal)));
  const term = Math.max(1, Number.parseInt(termMonths, 10) || 1);
  const monthlyRate = Math.max(0, toMoneyNumber(annualInterestRate)) / 100 / 12;
  const exactMonthlyPayment = monthlyRate === 0
    ? financedPrincipal / term
    : (() => {
        const compoundFactor = Math.pow(1 + monthlyRate, term);
        return financedPrincipal * ((monthlyRate * compoundFactor) / (compoundFactor - 1));
      })();
  const monthlyPayment = roundMoney(exactMonthlyPayment);
  const totalInstallmentPayment = roundMoney(exactMonthlyPayment * term);
  const finalInstallmentPayment = roundMoney(
    totalInstallmentPayment - (monthlyPayment * Math.max(0, term - 1))
  );

  return {
    monthlyPayment,
    finalInstallmentPayment,
    totalInstallmentPayment
  };
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
  const requiredDownpayment = downpaymentAmount !== undefined && downpaymentAmount !== ''
    ? roundMoney(downpaymentAmount)
    : roundMoney(totalContractPrice * (toMoneyNumber(downpaymentPercentage) / 100));
  const remainingDownpayment = roundMoney(Math.max(0, requiredDownpayment - holdFee));
  const initialAmountDue = roundMoney(holdFee + remainingDownpayment);

  if (paymentType === 'full_payment') {
    return {
      paymentType,
      totalContractPrice,
      reservationFee: holdFee,
      downpaymentAmount: 0,
      requiredDownpayment: 0,
      remainingDownpayment: 0,
      reservationFeeAppliedToDownpayment: false,
      downpaymentPercentage: 0,
      initialAmountDue: totalContractPrice,
      principalBalance: totalContractPrice,
      remainingBalance: totalContractPrice,
      totalInterest: 0,
      totalPayable: totalContractPrice,
      installmentTermMonths: null,
      monthlyPayment: null,
      interestRate: roundMoney(interestRate),
      status: 'pending_initial_payment'
    };
  }

  if (paymentType === 'installment') {
    const term = Math.max(1, Number.parseInt(installmentTermMonths, 10) || 12);
    const principalBalance = roundMoney(Math.max(0, totalContractPrice - initialAmountDue));
    const amortization = calculateAmortizedPaymentDetails({
      principal: principalBalance,
      annualInterestRate: interestRate,
      termMonths: term
    });
    const monthlyPayment = amortization.monthlyPayment;
    const installmentTotal = amortization.totalInstallmentPayment;
    const totalInterest = roundMoney(Math.max(0, installmentTotal - principalBalance));
    const totalPayable = roundMoney(initialAmountDue + installmentTotal);

    return {
      paymentType,
      totalContractPrice,
      reservationFee: holdFee,
      downpaymentAmount: requiredDownpayment,
      requiredDownpayment,
      remainingDownpayment,
      reservationFeeAppliedToDownpayment: true,
      downpaymentPercentage: toMoneyNumber(downpaymentPercentage),
      initialAmountDue,
      principalBalance,
      remainingBalance: totalPayable,
      totalInterest,
      totalPayable,
      installmentTermMonths: term,
      monthlyPayment,
      finalInstallmentPayment: amortization.finalInstallmentPayment,
      totalInstallmentPayment: installmentTotal,
      interestRate: roundMoney(interestRate),
      status: 'pending_initial_payment'
    };
  }

  const partialTerm = Math.max(1, Number.parseInt(installmentTermMonths, 10) || 6);
  const partialPrincipal = roundMoney(Math.max(0, totalContractPrice - initialAmountDue));
  const partialSchedule = calculateAmortizedPaymentDetails({
    principal: partialPrincipal,
    annualInterestRate: 0,
    termMonths: partialTerm
  });

  return {
    paymentType: 'partial_payment',
    totalContractPrice,
    reservationFee: holdFee,
    downpaymentAmount: requiredDownpayment,
    requiredDownpayment,
    remainingDownpayment,
    reservationFeeAppliedToDownpayment: true,
    downpaymentPercentage: toMoneyNumber(downpaymentPercentage),
    initialAmountDue,
    principalBalance: partialPrincipal,
    remainingBalance: totalContractPrice,
    totalInterest: 0,
    totalPayable: totalContractPrice,
    installmentTermMonths: partialTerm,
    monthlyPayment: partialSchedule.monthlyPayment,
    finalInstallmentPayment: partialSchedule.finalInstallmentPayment,
    totalInstallmentPayment: partialSchedule.totalInstallmentPayment,
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
  totalPaymentDue,
  initialAmountDue,
  overdueCount = 0
}) {
  const paid = roundMoney(amountPaid);
  const total = roundMoney(totalPaymentDue ?? totalContractPrice);
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
