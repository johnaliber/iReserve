'use client';

import React from 'react';

export default function UserAccessScopeManager({ villages, selectedVillageIds, onChange, disabled = false }) {
  const toggle = (id) => onChange(selectedVillageIds.includes(id) ? selectedVillageIds.filter((item) => item !== id) : [...selectedVillageIds, id]);
  return <div className="max-h-56 space-y-2 overflow-auto rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">{villages.map((village) => <label key={village.id} className="flex cursor-pointer items-center gap-3 rounded-lg bg-white px-3 py-2"><input disabled={disabled} type="checkbox" checked={selectedVillageIds.includes(village.id)} onChange={() => toggle(village.id)} className="accent-emerald-600" /><span className="text-sm font-bold text-[#272727]">{village.name}</span><span className="ml-auto text-xs text-[#94a3b8]">{village.village_code}</span></label>)}</div>;
}
