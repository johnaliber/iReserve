import { friendlyStatus, statusTone } from '@/lib/customer/statusLabels';

const tones = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
  muted: 'border-slate-200 bg-slate-50 text-slate-600'
};

export default function FriendlyStatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${tones[statusTone(status)]}`}>
      {friendlyStatus(status)}
    </span>
  );
}
