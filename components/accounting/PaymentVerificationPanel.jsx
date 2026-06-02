'use client';

import React from 'react';
import PaymentAmountIndicator from '@/components/payments/PaymentAmountIndicator';

export default function PaymentVerificationPanel({ plan }) {
  if (!plan) return null;
  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-extrabold text-[#272727]">Customer Payment Amount Indicator</h3>
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
