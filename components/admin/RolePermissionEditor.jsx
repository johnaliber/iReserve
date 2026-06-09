'use client';

import React from 'react';

export default function RolePermissionEditor({ permissions, selectedIds, onChange, disabled = false }) {
  const groups = permissions.reduce((result, permission) => ({ ...result, [permission.category]: [...(result[permission.category] || []), permission] }), {});
  const toggle = (id) => onChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  return <div className="grid gap-4 lg:grid-cols-2">{Object.entries(groups).map(([category, items]) => <div key={category} className="rounded-xl border border-[#e2e8f0] p-4"><h3 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-emerald-700">{category}</h3><div className="space-y-2">{items.map((permission) => <label key={permission.id} className="flex cursor-pointer items-start gap-3 rounded-lg bg-[#f8fafc] p-3"><input disabled={disabled} type="checkbox" checked={selectedIds.includes(permission.id)} onChange={() => toggle(permission.id)} className="mt-1 accent-emerald-600" /><span><span className="block text-sm font-bold text-[#272727]">{permission.display_name}</span><span className="text-xs font-mono text-[#64748b]">{permission.name}</span></span></label>)}</div></div>)}</div>;
}
