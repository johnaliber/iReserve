'use client';

import React from 'react';
import { calculatePaymentPlan, formatPeso } from '@/lib/payments/paymentMath';

export default function PaymentCalculator({
  propertyPrice,
  reservationFee,
  paymentType,
  downpaymentAmount,
  downpaymentPercentage,
  installmentTermMonths,
  interestRate = 0
}) {
  const plan = calculatePaymentPlan({
    propertyPrice,
    reservationFee,
    paymentType,
    downpaymentAmount,
    downpaymentPercentage,
    installmentTermMonths,
    interestRate
  });

  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-extrabold text-[#272727]">Payment Breakdown</h3>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-[#64748b]">Total Property Price</dt><dd className="font-extrabold text-[#272727]">{formatPeso(plan.totalContractPrice)}</dd></div>
        <div><dt className="text-[#64748b]">Reservation Fee</dt><dd className="font-extrabold text-[#272727]">{formatPeso(plan.reservationFee)}</dd></div>
        <div><dt className="text-[#64748b]">Downpayment</dt><dd className="font-extrabold text-[#272727]">{formatPeso(plan.downpaymentAmount)}</dd></div>
        <div><dt className="text-[#64748b]">Initial Amount Due</dt><dd className="font-extrabold text-emerald-600">{formatPeso(plan.initialAmountDue)}</dd></div>
        {plan.monthlyPayment && <div><dt className="text-[#64748b]">Monthly Payment</dt><dd className="font-extrabold text-[#272727]">{formatPeso(plan.monthlyPayment)}</dd></div>}
        {plan.paymentType === 'installment' && <div><dt className="text-[#64748b]">Interest Rate</dt><dd className="font-extrabold text-[#272727]">{plan.interestRate}%</dd></div>}
        {plan.installmentTermMonths && <div><dt className="text-[#64748b]">Installment Term</dt><dd className="font-extrabold text-[#272727]">{plan.installmentTermMonths} months</dd></div>}
      </dl>
    </div>
  );
}
