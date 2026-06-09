import React from 'react';

export default function AdminStatusBadge({ status = 'active' }) {
  const style = {
    active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    inactive: 'border-slate-200 bg-slate-50 text-slate-600',
    suspended: 'border-red-200 bg-red-50 text-red-700',
    pending: 'border-amber-200 bg-amber-50 text-amber-700',
    approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    rejected: 'border-red-200 bg-red-50 text-red-700'
  }[status] || 'border-slate-200 bg-slate-50 text-slate-600';
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${style}`}>{status.replaceAll('_', ' ')}</span>;
}
