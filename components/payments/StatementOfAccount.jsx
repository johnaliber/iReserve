'use client';

import React from 'react';
import PaymentSummaryCard from './PaymentSummaryCard';
import PaymentHistoryTable from './PaymentHistoryTable';
import PaymentScheduleTable from './PaymentScheduleTable';

export default function StatementOfAccount({ customer, property, plan, payments = [], schedule = [] }) {
  return (
    <div className="space-y-5 rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-600">Statement of Account</p>
        <h2 className="mt-1 text-2xl font-extrabold text-[#272727]">{customer?.full_name || customer?.email || 'Customer Account'}</h2>
        <p className="text-sm text-[#64748b]">{property?.property_code} - {property?.villages?.name}</p>
      </div>
      <PaymentSummaryCard plan={plan} />
      <PaymentHistoryTable payments={payments} />
      <PaymentScheduleTable rows={schedule} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-lg border border-[#dbe4ee] px-3 py-2 text-xs font-bold text-[#272727]">Export Statement PDF</button>
        <button type="button" className="rounded-lg border border-[#dbe4ee] px-3 py-2 text-xs font-bold text-[#272727]">Export CSV</button>
      </div>
    </div>
  );
}
