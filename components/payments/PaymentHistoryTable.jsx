'use client';

import React from 'react';
import { formatPeso } from '@/lib/payments/paymentMath';

export default function PaymentHistoryTable({ payments = [] }) {
  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-extrabold text-[#272727]">Payment History</h3>
      <div className="space-y-2">
        {payments.length === 0 ? (
          <p className="text-sm text-[#64748b]">No payments recorded yet.</p>
        ) : payments.map((payment) => (
          <div key={payment.id} className="flex items-center justify-between rounded-lg bg-[#f8fafc] p-3 text-sm">
            <div>
              <p className="font-bold text-[#272727]">{formatPeso(payment.amount)}</p>
              <p className="text-xs text-[#64748b]">{payment.payment_purpose?.replaceAll('_', ' ')} - {payment.reference_number || 'No reference'}</p>
            </div>
            <span className="text-xs font-extrabold uppercase text-[#64748b]">{payment.payment_status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
