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
  const remainingAfterInitial = Math.max(0, plan.totalContractPrice - plan.initialAmountDue);
  const downpaymentFormula = `${formatPeso(plan.totalContractPrice)} x ${plan.downpaymentPercentage || 0}%`;

  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-extrabold text-[#272727]">Payment Breakdown</h3>
        <p className="mt-1 text-xs leading-relaxed text-[#64748b]">
          This shows what must be paid now for accounting review and how the remaining balance is computed after the reservation is verified.
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
          <dt className="text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">Total Property Price</dt>
          <dd className="mt-1 font-extrabold text-[#272727]">{formatPeso(plan.totalContractPrice)}</dd>
        </div>
        <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
          <dt className="text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">Reservation Fee</dt>
          <dd className="mt-1 font-extrabold text-[#272727]">{formatPeso(plan.reservationFee)}</dd>
        </div>
        <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
          <dt className="text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">Downpayment</dt>
          <dd className="mt-1 font-extrabold text-[#272727]">{formatPeso(plan.downpaymentAmount)}</dd>
          {plan.paymentType !== 'full_payment' && (
            <dd className="mt-1 text-[11px] text-[#64748b]">{downpaymentFormula}</dd>
          )}
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <dt className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Initial Amount Due Now</dt>
          <dd className="mt-1 font-extrabold text-emerald-700">{formatPeso(plan.initialAmountDue)}</dd>
          <dd className="mt-1 text-[11px] text-emerald-700">
            {plan.paymentType === 'full_payment'
              ? 'Full property price is due for this payment option.'
              : `${formatPeso(plan.reservationFee)} reservation fee + ${formatPeso(plan.downpaymentAmount)} downpayment`}
          </dd>
        </div>
        {plan.paymentType !== 'full_payment' && (
          <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
            <dt className="text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">Balance After Initial Payment</dt>
            <dd className="mt-1 font-extrabold text-[#272727]">{formatPeso(remainingAfterInitial)}</dd>
            <dd className="mt-1 text-[11px] text-[#64748b]">
              {formatPeso(plan.totalContractPrice)} - {formatPeso(plan.initialAmountDue)}
            </dd>
          </div>
        )}
        {plan.monthlyPayment && (
          <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
            <dt className="text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">Estimated Monthly Payment</dt>
            <dd className="mt-1 font-extrabold text-[#272727]">{formatPeso(plan.monthlyPayment)}</dd>
            <dd className="mt-1 text-[11px] text-[#64748b]">
              {formatPeso(plan.principalBalance)} balance / {plan.installmentTermMonths} months
            </dd>
          </div>
        )}
        {plan.paymentType === 'installment' && (
          <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
            <dt className="text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">Installment Terms</dt>
            <dd className="mt-1 font-extrabold text-[#272727]">{plan.installmentTermMonths} months</dd>
            <dd className="mt-1 text-[11px] text-[#64748b]">Annual interest rate on record: {plan.interestRate}%</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
