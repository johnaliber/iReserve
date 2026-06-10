import React from 'react';

export default function AdminStatusBadge({ status = 'active' }) {
  const style = {
    active: 'border-emerald-300 bg-emerald-100 text-emerald-800',
    inactive: 'border-[#cbd5e1] bg-[#e2e8f0] text-[#1e293b]',
    suspended: 'border-red-300 bg-red-100 text-red-900',
    pending: 'border-amber-300 bg-amber-100 text-amber-900',
    approved: 'border-emerald-300 bg-emerald-100 text-emerald-800',
    rejected: 'border-red-300 bg-red-100 text-red-900'
  }[status] || 'border-[#cbd5e1] bg-[#e2e8f0] text-[#1e293b]';
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide ${style}`}>{status.replaceAll('_', ' ')}</span>;
}
