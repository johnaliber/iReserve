import { friendlyStatus, statusTone } from '@/lib/customer/statusLabels';

const tones = {
  success: 'border-emerald-300 bg-emerald-100 text-emerald-800',
  warning: 'border-amber-300 bg-amber-100 text-amber-900',
  danger: 'border-rose-300 bg-rose-100 text-rose-900',
  muted: 'border-[#cbd5e1] bg-[#e2e8f0] text-[#1e293b]'
};

export default function FriendlyStatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide ${tones[statusTone(status)]}`}>
      {friendlyStatus(status)}
    </span>
  );
}
