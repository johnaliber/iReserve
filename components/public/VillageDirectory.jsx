'use client';

import { useMemo, useState } from 'react';
import { MapPin, Search, SlidersHorizontal } from 'lucide-react';
import VillageCarousel from './VillageCarousel';
import EmptyState from '@/components/shared/EmptyState';

export default function VillageDirectory({ villages = [] }) {
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);

  const locations = useMemo(() => [...new Set(villages.map((village) => [village.city, village.province].filter(Boolean).join(', ')).filter(Boolean))], [villages]);
  const filtered = villages.filter((village) => {
    const haystack = `${village.name} ${village.city} ${village.province}`.toLowerCase();
    if (search && !haystack.includes(search.toLowerCase())) return false;
    if (location && `${village.city}, ${village.province}` !== location) return false;
    if (maxPrice && Number(village.starting_price || 0) > Number(maxPrice)) return false;
    if (availableOnly && Number(village.available_count || 0) < 1) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto]">
          <label className="relative">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-[#94a3b8]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search village" className="min-h-11 w-full rounded-xl border border-[#dbe4ee] pl-10 pr-3 text-sm outline-none focus:border-emerald-500" />
          </label>
          <label className="relative">
            <MapPin className="absolute left-3.5 top-3.5 h-4 w-4 text-[#94a3b8]" />
            <select value={location} onChange={(event) => setLocation(event.target.value)} className="min-h-11 w-full appearance-none rounded-xl border border-[#dbe4ee] bg-white pl-10 pr-3 text-sm outline-none focus:border-emerald-500">
              <option value="">All locations</option>
              {locations.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="relative">
            <SlidersHorizontal className="absolute left-3.5 top-3.5 h-4 w-4 text-[#94a3b8]" />
            <select value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} className="min-h-11 w-full appearance-none rounded-xl border border-[#dbe4ee] bg-white pl-10 pr-3 text-sm outline-none focus:border-emerald-500">
              <option value="">Any price</option>
              <option value="3000000">Up to PHP 3M</option>
              <option value="5000000">Up to PHP 5M</option>
              <option value="10000000">Up to PHP 10M</option>
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[#dbe4ee] px-3 text-sm font-bold text-[#475569]">
            <input type="checkbox" checked={availableOnly} onChange={(event) => setAvailableOnly(event.target.checked)} className="h-4 w-4 accent-emerald-600" />
            Available only
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No villages found" description="Try adjusting your search or filters." />
      ) : (
        <VillageCarousel villages={filtered} />
      )}
    </div>
  );
}
