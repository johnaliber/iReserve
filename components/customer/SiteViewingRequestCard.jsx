import FriendlyStatusBadge from './FriendlyStatusBadge';

export default function SiteViewingRequestCard({ viewing }) {
  const property = viewing.properties || {};
  return (
    <article className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-extrabold text-[#272727]">Block {property.block_number || '-'}, Lot {property.lot_number || '-'}</h3>
          <p className="mt-1 text-sm text-[#64748b]">{viewing.villages?.name || 'Village'}</p>
        </div>
        <div className="sm:text-right">
          <FriendlyStatusBadge status={viewing.status} />
          <p className="mt-2 text-sm font-bold text-[#272727]">{viewing.preferred_date} at {viewing.preferred_time}</p>
        </div>
      </div>
    </article>
  );
}
