'use client';

import React from 'react';
import { formatPeso, roundMoney } from '@/lib/payments/paymentMath';

function rowStatus(row) {
  const today = new Date().toISOString().slice(0, 10);
  if (Number(row.amount_paid || 0) > Number(row.amount_due || 0)) return 'overpaid';
  if (Number(row.amount_paid || 0) >= Number(row.amount_due || 0)) return 'paid';
  if (row.due_date < today) return 'overdue';
  if (Number(row.amount_paid || 0) > 0) return 'partially_paid';
  return row.status || 'unpaid';
}

export default function PaymentScheduleTable({ rows = [], onPay }) {
  if (!rows.length) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-[#f8fafc] text-xs font-extrabold uppercase tracking-wider text-[#64748b]">
          <tr>
            <th className="px-3 py-3">Due No.</th>
            <th className="px-3 py-3">Due Date</th>
            <th className="px-3 py-3">Amount Due</th>
            <th className="px-3 py-3">Amount Paid</th>
            <th className="px-3 py-3">Remaining Due</th>
            <th className="px-3 py-3">Status Indicator</th>
            <th className="px-3 py-3">Payment Progress</th>
            <th className="px-3 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e2e8f0]">
          {rows.map((row) => {
            const progress = Math.min(100, roundMoney((Number(row.amount_paid || 0) / Number(row.amount_due || 1)) * 100));
            const status = rowStatus(row);
            return (
              <tr key={row.id}>
                <td className="px-3 py-3 font-bold text-[#272727]">{row.due_number}</td>
                <td className="px-3 py-3 text-[#64748b]">{new Date(row.due_date).toLocaleDateString()}</td>
                <td className="px-3 py-3">{formatPeso(row.amount_due)}</td>
                <td className="px-3 py-3">{formatPeso(row.amount_paid)}</td>
                <td className="px-3 py-3">{formatPeso(row.remaining_due)}</td>
                <td className="px-3 py-3 capitalize">{status.replaceAll('_', ' ')}</td>
                <td className="px-3 py-3">{progress}%</td>
                <td className="px-3 py-3 text-right">
                  {onPay && <button type="button" onClick={() => onPay(row)} className="font-bold text-emerald-600">Pay</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
