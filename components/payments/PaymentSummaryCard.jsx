'use client';

import React from 'react';
import { PAYMENT_TYPES, formatPeso } from '@/lib/payments/paymentMath';
import PaymentAmountIndicator from './PaymentAmountIndicator';

export default function PaymentSummaryCard({ plan }) {
  if (!plan) return null;
  const termMonths = Math.max(1, Number(plan.installment_term_months || 6));
  const monthlyPayment = Number(plan.monthly_payment || 0) > 0
    ? Number(plan.monthly_payment)
    : Number(plan.remaining_balance || 0) / termMonths;

  return (
    <div className="space-y-4 rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-600">{PAYMENT_TYPES[plan.payment_type] || plan.payment_type}</p>
        <h3 className="mt-1 text-lg font-extrabold text-[#272727]">Payment Summary</h3>
      </div>
      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div><p className="text-[#64748b]">Total Contract Price</p><p className="font-extrabold text-[#272727]">{formatPeso(plan.total_contract_price)}</p></div>
        <div><p className="text-[#64748b]">Initial Amount Due</p><p className="font-extrabold text-[#272727]">{formatPeso(plan.initial_amount_due)}</p></div>
        <div><p className="text-[#64748b]">Amount Paid</p><p className="font-extrabold text-[#272727]">{formatPeso(plan.amount_paid)}</p></div>
        <div><p className="text-[#64748b]">Remaining Balance</p><p className="font-extrabold text-[#272727]">{formatPeso(plan.remaining_balance)}</p></div>
        {monthlyPayment > 0 && <div><p className="text-[#64748b]">Monthly Payment</p><p className="font-extrabold text-[#272727]">{formatPeso(monthlyPayment)}</p></div>}
        {termMonths > 0 && <div><p className="text-[#64748b]">Term</p><p className="font-extrabold text-[#272727]">{termMonths} months</p></div>}
      </div>
      <PaymentAmountIndicator
        paymentType={plan.payment_type}
        totalContractPrice={plan.total_contract_price}
        initialAmountDue={plan.initial_amount_due}
        amountPaid={plan.amount_paid}
        remainingBalance={plan.remaining_balance}
        totalPaymentProgress={plan.total_payment_progress}
        initialPaymentProgress={plan.initial_payment_progress}
        indicator={plan.payment_amount_indicator}
        overdueCount={plan.overdue_count}
        nextDueDate={plan.next_due_date}
      />
    </div>
  );
}
