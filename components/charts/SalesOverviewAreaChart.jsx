'use client';

import React from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AdminSectionCard from '@/components/admin/AdminSectionCard';

function peso(value) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', notation: 'compact' }).format(Number(value || 0));
}

const series = [
  ['sales', '#10b981'],
  ['reservationFees', '#0ea5e9'],
  ['downpayments', '#8b5cf6'],
  ['installments', '#f59e0b'],
  ['fullPayments', '#14b8a6']
];

export default function SalesOverviewAreaChart({ data, title = 'Sales Overview', subtitle, actions }) {
  return (
    <AdminSectionCard title={title} subtitle={subtitle} actions={actions}>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              {series.map(([key, color]) => <linearGradient key={key} id={`${key}Fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={color} stopOpacity={0.24} /><stop offset="95%" stopColor={color} stopOpacity={0} /></linearGradient>)}
            </defs>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
            <YAxis stroke="#64748b" fontSize={12} tickFormatter={peso} />
            <Tooltip formatter={(value, name) => [peso(value), name.replace(/([A-Z])/g, ' $1')]} />
            {series.map(([key, color]) => <Area key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={key === 'sales' ? 3 : 2} fill={`url(#${key}Fill)`} />)}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </AdminSectionCard>
  );
}
