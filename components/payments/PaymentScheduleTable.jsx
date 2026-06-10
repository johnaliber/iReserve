'use client';

import React from 'react';
import { formatPeso, roundMoney } from '@/lib/payments/paymentMath';
import { normalizeMonthlyScheduleRows } from '@/lib/payments/scheduleDates';
import FriendlyStatusBadge from '@/components/customer/FriendlyStatusBadge';

function rowStatus(row) {
  const today = new Date().toISOString().slice(0, 10);
  if (Number(row.amount_paid || 0) > Number(row.amount_due || 0)) return 'overpaid';
  if (Number(row.amount_paid || 0) >= Number(row.amount_due || 0)) return 'paid';
  if (row.due_date < today) return 'overdue';
  if (Number(row.amount_paid || 0) > 0) return 'partially_paid';
  return row.status || 'unpaid';
}

function formatDueDate(value) {
  if (!value) return '-';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  if (year && month && day) return `${month}-${day}-${year.slice(-2)}`;
  const date = new Date(value);
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getFullYear()).slice(-2)}`;
}

export default function PaymentScheduleTable({ rows = [], onPay }) {
  const monthlyRows = normalizeMonthlyScheduleRows(rows);
  if (!monthlyRows.length) return null;

  return (
    <>
    <div className="space-y-3 md:hidden">
      {monthlyRows.map((row) => {
        const status = rowStatus(row);
        const canPay = onPay && ['unpaid', 'partially_paid', 'overdue'].includes(status) && Number(row.remaining_due || 0) > 0;
        return (
          <article key={row.id} className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs font-bold text-[#475b52]">Payment {row.due_number}</p><p className="mt-1 font-extrabold text-[#272727]">{formatDueDate(row.due_date)}</p><p className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-[#5f7068]">MM-DD-YY</p></div>
              <FriendlyStatusBadge status={status} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-[#64748b]">Amount Due</p><p className="font-extrabold">{formatPeso(row.amount_due)}</p></div>
              <div><p className="text-xs text-[#64748b]">Amount Paid</p><p className="font-extrabold">{formatPeso(row.amount_paid)}</p></div>
              <div><p className="text-xs text-[#64748b]">Remaining</p><p className="font-extrabold">{formatPeso(row.remaining_due)}</p></div>
            </div>
            {canPay && <button type="button" onClick={() => onPay(row)} className="mt-4 min-h-11 w-full rounded-xl bg-emerald-600 text-sm font-extrabold text-white">Pay Now</button>}
          </article>
        );
      })}
    </div>
    <div className="hidden overflow-x-auto rounded-xl border border-[#e2e8f0] bg-white shadow-sm md:block">
      <table className="w-full min-w-[1050px] table-auto text-left text-sm">
        <thead className="bg-[#f8fafc] text-xs font-extrabold uppercase tracking-wider text-[#64748b]">
          <tr>
            <th className="whitespace-nowrap px-3 py-2.5">Payment No.</th>
            <th className="whitespace-nowrap px-3 py-2.5">Due Date <span className="normal-case tracking-normal text-[#5f7068]">(MM-DD-YY)</span></th>
            <th className="whitespace-nowrap px-3 py-2.5">Amount Due</th>
            <th className="whitespace-nowrap px-3 py-2.5">Amount Paid</th>
            <th className="whitespace-nowrap px-3 py-2.5">Remaining Balance</th>
            <th className="whitespace-nowrap px-3 py-2.5">Status</th>
            <th className="whitespace-nowrap px-3 py-2.5">Progress</th>
            <th className="whitespace-nowrap px-3 py-2.5 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e2e8f0]">
          {monthlyRows.map((row) => {
            const progress = Math.min(100, roundMoney((Number(row.amount_paid || 0) / Number(row.amount_due || 1)) * 100));
            const status = rowStatus(row);
            const canPay = onPay && ['unpaid', 'partially_paid', 'overdue'].includes(status) && Number(row.remaining_due || 0) > 0;
            return (
              <tr key={row.id}>
                <td className="whitespace-nowrap px-3 py-2.5 font-bold text-[#272727]">{row.due_number}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[#64748b]">{formatDueDate(row.due_date)}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{formatPeso(row.amount_due)}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{formatPeso(row.amount_paid)}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{formatPeso(row.remaining_due)}</td>
                <td className="whitespace-nowrap px-3 py-2.5"><FriendlyStatusBadge status={status} /></td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <div className="flex min-w-28 items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e2e8f0]">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="w-10 text-right font-bold">{progress}%</span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  {canPay ? (
                    <button type="button" onClick={() => onPay(row)} className="font-bold text-emerald-600">
                      Pay Now
                    </button>
                  ) : (
                    <span className="text-xs font-medium text-[#5f7068]">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}
