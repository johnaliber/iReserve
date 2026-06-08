import FriendlyStatusBadge from './FriendlyStatusBadge';

export default function ReservationSummaryCard({ reservation, action }) {
  const property = reservation?.properties || {};
  return (
    <article className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-extrabold text-[#272727]">Block {property.block_number || '-'}, Lot {property.lot_number || '-'}</h3>
            <FriendlyStatusBadge status={reservation?.status} />
          </div>
          <p className="mt-1 text-sm text-[#64748b]">{property.villages?.name || 'Village'}</p>
        </div>
        {action}
      </div>
    </article>
  );
}
