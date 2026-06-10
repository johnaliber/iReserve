export default function CustomerDashboardCard({ icon: Icon, label, value, helper, tone = 'emerald' }) {
  const color = tone === 'amber' ? 'bg-amber-50 text-amber-700' : tone === 'rose' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700';
  return (
    <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold text-[#475b52]">{label}</p>
          <p className="mt-2 text-2xl font-extrabold text-[#272727]">{value}</p>
          {helper && <p className="mt-1 text-xs font-medium leading-5 text-[#475b52]">{helper}</p>}
        </div>
        {Icon && <span className={`rounded-xl p-2.5 ${color}`}><Icon className="h-5 w-5" /></span>}
      </div>
    </div>
  );
}
