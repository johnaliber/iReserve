'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatPeso, roundMoney } from '@/lib/payments/paymentMath';

const styles = {
  not_paid: ['Not Paid', 'bg-gray-50 text-gray-700 border-gray-200', 'No payment has been verified yet.'],
  insufficient_payment: ['Insufficient Payment', 'bg-red-50 text-red-700 border-red-200', 'Customer has paid below the required initial amount.'],
  partially_paid: ['Partially Paid', 'bg-blue-50 text-blue-700 border-blue-200', 'Initial payment requirement is completed, but balance remains.'],
  initial_payment_completed: ['Initial Payment Completed', 'bg-emerald-50 text-emerald-700 border-emerald-200', 'Required reservation/downpayment has been completed.'],
  fully_paid: ['Fully Paid', 'bg-emerald-50 text-emerald-700 border-emerald-200', 'Customer has completed the full property payment.'],
  overdue: ['Overdue', 'bg-red-50 text-red-700 border-red-200', 'Customer has overdue payment/s.'],
  overpaid: ['Overpaid', 'bg-purple-50 text-purple-700 border-purple-200', 'Customer has paid more than the total contract price.']
};

function ProgressLine({ label, paid, required, progress }) {
  const pct = Math.min(100, Math.max(0, roundMoney(progress)));
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-bold text-[#64748b]">{label}</span>
        <span className="font-extrabold text-[#272727]">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#e2e8f0]">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-[#64748b]">
        {formatPeso(paid)} paid of {formatPeso(required)}
      </p>
    </div>
  );
}

export default function PaymentAmountIndicator({
  paymentType,
  totalContractPrice,
  initialAmountDue,
  amountPaid,
  remainingBalance,
  totalPaymentProgress,
  initialPaymentProgress,
  indicator = 'not_paid',
  overdueCount = 0,
  nextDueDate
}) {
  const [label, className, message] = styles[indicator] || styles.not_paid;
  const showInitial = ['partial_payment', 'installment'].includes(paymentType);

  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-[#272727]">Payment Progress</h3>
          <p className="text-xs text-[#64748b]">Remaining Balance: {formatPeso(remainingBalance)}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider ${className}`}>
          {label}
        </span>
      </div>

      <div className="space-y-4">
        {showInitial && (
          <ProgressLine
            label="Initial Payment Requirement"
            paid={amountPaid}
            required={initialAmountDue}
            progress={initialPaymentProgress}
          />
        )}
        <ProgressLine
          label={paymentType === 'full_payment' ? 'Full Payment Progress' : 'Total Contract Progress'}
          paid={amountPaid}
          required={totalContractPrice}
          progress={totalPaymentProgress}
        />
      </div>

      <div className="mt-4 flex gap-2 rounded-lg bg-[#f8fafc] p-3 text-xs text-[#64748b]">
        {indicator === 'fully_paid' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
        <div>
          <p className="font-bold text-[#272727]">{message}</p>
          {overdueCount > 0 && <p>{overdueCount} overdue payment{overdueCount === 1 ? '' : 's'}.</p>}
          {nextDueDate && <p>Next due date: {new Date(nextDueDate).toLocaleDateString()}</p>}
        </div>
      </div>
    </div>
  );
}
