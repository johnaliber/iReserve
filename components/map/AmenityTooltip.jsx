'use client';

import Image from 'next/image';
import { getAmenityTypeLabel } from '@/lib/blueprints/amenities';

export default function AmenityTooltip({ amenity }) {
  if (!amenity) return null;

  return (
    <div>
      {amenity.imageUrl && (
        <div className="relative h-36 overflow-hidden bg-[#f1f5f9]">
          <Image src={amenity.imageUrl} alt={amenity.name} fill unoptimized className="object-cover" />
        </div>
      )}
      <div className="p-4">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-700">
        {getAmenityTypeLabel(amenity.amenityType)}
      </p>
      <h3 className="mt-1 text-base font-extrabold text-[#171717]">
        {amenity.name}
      </h3>
      {amenity.description && (
        <p className="mt-2 text-xs leading-5 text-[#475569]">
          {amenity.description}
        </p>
      )}
      </div>
    </div>
  );
}
