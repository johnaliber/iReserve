'use client';

import React from 'react';
import { PAYMENT_TYPES, calculatePaymentPlan, formatPeso } from '@/lib/payments/paymentMath';

export default function PaymentCalculator({
  propertyPrice,
  reservationFee,
  paymentType,
  downpaymentAmount,
  downpaymentPercentage,
  installmentTermMonths,
  interestRate = 0,
  reservationFeeOnly = false
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
  const remainingAfterInitial = plan.principalBalance;
  const downpaymentFormula = `${formatPeso(plan.totalContractPrice)} x ${plan.downpaymentPercentage || 0}%`;

  if (reservationFeeOnly) {
    return (
      <div className="rounded-xl border border-[#d7e7df] bg-white p-5 shadow-sm">
        <div className="mb-4">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Reservation fee only</p>
          <h3 className="mt-1 text-sm font-extrabold text-[#272727]">Payment Breakdown</h3>
          <p className="mt-1 text-xs leading-relaxed text-[#475569]">
            You only need to pay the reservation fee today. Your selected payment option will be saved and applied after you create your account.
          </p>
        </div>

        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
            <dt className="text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">Total Property Price</dt>
            <dd className="mt-1 font-extrabold text-[#272727]">{formatPeso(plan.totalContractPrice)}</dd>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <dt className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Reservation Fee Due Today</dt>
            <dd className="mt-1 font-extrabold text-emerald-800">{formatPeso(plan.reservationFee)}</dd>
          </div>
          <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
            <dt className="text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">Selected Payment Option</dt>
            <dd className="mt-1 font-extrabold text-[#272727]">{PAYMENT_TYPES[plan.paymentType]}</dd>
          </div>
          {plan.paymentType !== 'full_payment' && (
            <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
              <dt className="text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">Downpayment Percentage</dt>
              <dd className="mt-1 font-extrabold text-[#272727]">{plan.downpaymentPercentage}%</dd>
            </div>
          )}
          {plan.paymentType === 'installment' && (
            <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
              <dt className="text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">Loan Term</dt>
              <dd className="mt-1 font-extrabold text-[#272727]">{plan.installmentTermMonths} months</dd>
            </div>
          )}
          <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 sm:col-span-2">
            <dt className="text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">After Account Creation</dt>
            <dd className="mt-1 font-bold text-[#334155]">
              Your selected payment plan will be applied and the remaining required amount will appear in your customer dashboard.
            </dd>
          </div>
        </dl>

        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold leading-5 text-emerald-800">
          The reservation fee is part of the property payment and will be deducted from your remaining balance.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-extrabold text-[#272727]">Payment Breakdown</h3>
        <p className="mt-1 text-xs leading-relaxed text-[#64748b]">
          The reservation fee is part of the required downpayment and is deducted from the remaining equity due.
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
          {plan.paymentType !== 'full_payment' && (
            <dd className="mt-1 text-[11px] font-bold text-emerald-700">Applied to Downpayment: Yes</dd>
          )}
        </div>
        <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
          <dt className="text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">Required Downpayment</dt>
          <dd className="mt-1 font-extrabold text-[#272727]">{formatPeso(plan.requiredDownpayment)}</dd>
          {plan.paymentType !== 'full_payment' && (
            <dd className="mt-1 text-[11px] text-[#64748b]">{downpaymentFormula}</dd>
          )}
        </div>
        {plan.paymentType !== 'full_payment' && (
          <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
            <dt className="text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">Remaining Downpayment</dt>
            <dd className="mt-1 font-extrabold text-[#272727]">{formatPeso(plan.remainingDownpayment)}</dd>
            <dd className="mt-1 text-[11px] text-[#64748b]">
              {formatPeso(plan.requiredDownpayment)} - {formatPeso(plan.reservationFee)}
            </dd>
          </div>
        )}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <dt className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Total Initial Payment</dt>
          <dd className="mt-1 font-extrabold text-emerald-700">{formatPeso(plan.initialAmountDue)}</dd>
          <dd className="mt-1 text-[11px] text-emerald-700">
            {plan.paymentType === 'full_payment'
              ? 'Full property price is due for this payment option.'
              : `${formatPeso(plan.reservationFee)} reservation fee + ${formatPeso(plan.remainingDownpayment)} remaining downpayment`}
          </dd>
        </div>
        {plan.paymentType !== 'full_payment' && (
          <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
            <dt className="text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">Balance for Installment</dt>
            <dd className="mt-1 font-extrabold text-[#272727]">{formatPeso(remainingAfterInitial)}</dd>
            <dd className="mt-1 text-[11px] text-[#64748b]">
              Amount financed before interest
            </dd>
          </div>
        )}
        {plan.monthlyPayment && (
          <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
            <dt className="text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">Estimated Monthly Payment</dt>
            <dd className="mt-1 font-extrabold text-[#272727]">{formatPeso(plan.monthlyPayment)}</dd>
            <dd className="mt-1 text-[11px] text-[#64748b]">
              Amortized over {plan.installmentTermMonths} months at {plan.interestRate}% per year
            </dd>
          </div>
        )}
        {plan.paymentType === 'installment' && (
          <>
            <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
              <dt className="text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">Total Installment Payment</dt>
              <dd className="mt-1 font-extrabold text-[#272727]">{formatPeso(plan.totalInstallmentPayment)}</dd>
              <dd className="mt-1 text-[11px] text-[#64748b]">
                Sum of all {plan.installmentTermMonths} monthly installments
              </dd>
            </div>
            <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
              <dt className="text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">Total Interest</dt>
              <dd className="mt-1 font-extrabold text-[#272727]">{formatPeso(plan.totalInterest)}</dd>
              <dd className="mt-1 text-[11px] text-[#64748b]">
                Based on {plan.installmentTermMonths} months at {plan.interestRate}% per year
              </dd>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <dt className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Total Payable With Interest</dt>
              <dd className="mt-1 font-extrabold text-emerald-700">{formatPeso(plan.totalPayable)}</dd>
              <dd className="mt-1 text-[11px] text-emerald-700">
                Initial payment plus all monthly installments
              </dd>
            </div>
          </>
        )}
      </dl>
    </div>
  );
}
