import React from 'react';

export default function AdminStatsCard({ label, value, helper, icon: Icon, tone = 'emerald' }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
    slate: 'bg-slate-100 text-slate-600'
  };
  return (
    <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">{label}</p>
          <p className="mt-2 text-2xl font-extrabold text-[#272727]">{value}</p>
          {helper && <p className="mt-1 text-xs text-[#64748b]">{helper}</p>}
        </div>
        {Icon && <div className={`rounded-xl p-2.5 ${tones[tone] || tones.emerald}`}><Icon className="h-5 w-5" /></div>}
      </div>
    </div>
  );
}
