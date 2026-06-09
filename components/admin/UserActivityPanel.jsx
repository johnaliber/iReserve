import React from 'react';
import AdminEmptyState from './AdminEmptyState';

export default function UserActivityPanel({ logs }) {
  if (!logs?.length) return <AdminEmptyState title="No user activity recorded" />;
  return <div className="space-y-3">{logs.map((log) => <div key={log.id} className="rounded-xl border border-[#e2e8f0] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-extrabold text-[#272727]">{log.action.replaceAll('_', ' ')}</p><time className="text-xs text-[#94a3b8]">{new Date(log.created_at).toLocaleString()}</time></div><p className="mt-1 text-sm text-[#64748b]">{log.description || `${log.entity_type} activity`}</p>{log.villages?.name && <p className="mt-2 text-xs font-bold text-emerald-700">{log.villages.name}</p>}</div>)}</div>;
}
