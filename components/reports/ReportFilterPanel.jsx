'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Filter, RotateCcw, Search, X } from 'lucide-react';

const DATE_PRESETS = [
  ['today', 'Today'],
  ['week', 'This week'],
  ['month', 'This month'],
  ['year', 'This year'],
  ['custom', 'Custom']
];

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function presetDates(preset) {
  const now = new Date();
  const start = new Date(now);
  if (preset === 'today') return { dateFrom: isoDate(now), dateTo: isoDate(now) };
  if (preset === 'week') start.setDate(now.getDate() - now.getDay());
  if (preset === 'month') start.setDate(1);
  if (preset === 'year') start.setMonth(0, 1);
  return preset === 'custom' ? {} : { dateFrom: isoDate(start), dateTo: isoDate(now) };
}

function label(value) {
  return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function ReportFilterPanel({
  reportType,
  filters,
  onFilterChange,
  onApplyFilters,
  onResetFilters,
  availableVillages = [],
  availableStatuses = [],
  availableProperties = [],
  availableCustomers = [],
  availableUsers = [],
  currentUserRole
}) {
  const [advanced, setAdvanced] = useState(false);
  const selectedVillage = availableVillages.find((item) => item.id === filters.villageId);
  const selectedProperty = availableProperties.find((item) => item.id === filters.propertyId);
  const selectedCustomer = availableCustomers.find((item) => item.id === filters.customerId);
  const chips = useMemo(() => {
    const items = [];
    if (filters.dateFrom || filters.dateTo) items.push(['date', `Date: ${filters.dateFrom || 'Any'} - ${filters.dateTo || 'Any'}`]);
    if (selectedVillage) items.push(['villageId', `Village: ${selectedVillage.name}`]);
    if (selectedProperty) items.push(['propertyId', `Property: ${selectedProperty.property_code}`]);
    if (selectedCustomer) items.push(['customerId', `Customer: ${selectedCustomer.name}`]);
    for (const key of ['status', 'paymentStatus', 'reservationStatus', 'paymentType']) {
      if (filters[key]) items.push([key, `${label(key)}: ${label(filters[key])}`]);
    }
    if (filters.search) items.push(['search', `Search: ${filters.search}`]);
    return items;
  }, [filters, selectedCustomer, selectedProperty, selectedVillage]);

  const set = (key, value) => onFilterChange({ ...filters, [key]: value });
  const inputClass = 'h-10 rounded-xl border border-[#d8e1dd] bg-white px-3 text-xs font-semibold text-[#24332c] outline-none focus:border-emerald-500';
  const visibleProperties = filters.villageId
    ? availableProperties.filter((item) => item.village_id === filters.villageId)
    : availableProperties;

  return (
    <section className="rounded-2xl border border-[#d8e1dd] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-56 flex-1 items-center gap-2">
            <Filter className="h-4 w-4 text-emerald-600" />
            <div className="relative w-full">
              <Search className="absolute left-3 top-3 h-4 w-4 text-[#8a9a92]" />
              <input
                value={filters.search || ''}
                onChange={(event) => set('search', event.target.value)}
                placeholder={`Search ${label(reportType)}`}
                className={`${inputClass} w-full pl-9`}
              />
            </div>
          </div>
          <select
            value={filters.datePreset || 'month'}
            onChange={(event) => {
              const datePreset = event.target.value;
              onFilterChange({ ...filters, datePreset, ...presetDates(datePreset) });
            }}
            className={inputClass}
          >
            {DATE_PRESETS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
          <select value={filters.villageId || ''} onChange={(event) => set('villageId', event.target.value)} className={inputClass}>
            {currentUserRole === 'super_admin' && <option value="">All villages</option>}
            {availableVillages.map((village) => <option key={village.id} value={village.id}>{village.name}</option>)}
          </select>
          {availableStatuses.length > 0 && (
            <select value={filters.status || ''} onChange={(event) => set('status', event.target.value)} className={inputClass}>
              <option value="">All statuses</option>
              {availableStatuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}
            </select>
          )}
          <button
            type="button"
            onClick={() => setAdvanced((current) => !current)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d8e1dd] px-3 text-xs font-bold text-[#52635b]"
          >
            Advanced
            <ChevronDown className={`h-4 w-4 transition ${advanced ? 'rotate-180' : ''}`} />
          </button>
          <button type="button" onClick={onApplyFilters} className="h-10 rounded-xl bg-emerald-600 px-4 text-xs font-extrabold text-white hover:bg-emerald-500">
            Apply filters
          </button>
          <button type="button" onClick={onResetFilters} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d8e1dd] px-3 text-xs font-bold text-[#52635b]">
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </div>

        {advanced && (
          <div className="grid gap-2 border-t border-[#edf1ef] pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <input type="date" value={filters.dateFrom || ''} onChange={(event) => set('dateFrom', event.target.value)} className={inputClass} />
            <input type="date" value={filters.dateTo || ''} onChange={(event) => set('dateTo', event.target.value)} className={inputClass} />
            <select value={filters.propertyId || ''} onChange={(event) => set('propertyId', event.target.value)} className={inputClass}>
              <option value="">All properties</option>
              {visibleProperties.map((property) => <option key={property.id} value={property.id}>{property.property_code}</option>)}
            </select>
            <select value={filters.customerId || ''} onChange={(event) => set('customerId', event.target.value)} className={inputClass}>
              <option value="">All customers</option>
              {availableCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
            <select value={filters.paymentType || ''} onChange={(event) => set('paymentType', event.target.value)} className={inputClass}>
              <option value="">All payment types</option>
              {['full_payment', 'partial_payment', 'installment'].map((value) => <option key={value} value={value}>{label(value)}</option>)}
            </select>
            <select value={filters.reservationStatus || ''} onChange={(event) => set('reservationStatus', event.target.value)} className={inputClass}>
              <option value="">All reservation statuses</option>
              {['pending_payment', 'pending_documents', 'pending_verification', 'reserved', 'approved', 'rejected', 'cancelled', 'expired', 'converted_to_sale']
                .map((value) => <option key={value} value={value}>{label(value)}</option>)}
            </select>
            <select value={filters.paymentStatus || ''} onChange={(event) => set('paymentStatus', event.target.value)} className={inputClass}>
              <option value="">All payment statuses</option>
              {['unpaid', 'pending_verification', 'verified', 'rejected', 'partially_paid', 'overdue', 'refunded']
                .map((value) => <option key={value} value={value}>{label(value)}</option>)}
            </select>
            <select value={filters.createdBy || ''} onChange={(event) => set('createdBy', event.target.value)} className={inputClass}>
              <option value="">Created by anyone</option>
              {availableUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
            <select value={filters.approvedBy || ''} onChange={(event) => set('approvedBy', event.target.value)} className={inputClass}>
              <option value="">Approved by anyone</option>
              {availableUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
            <select value={filters.verifiedBy || ''} onChange={(event) => set('verifiedBy', event.target.value)} className={inputClass}>
              <option value="">Verified by anyone</option>
              {availableUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
            <select value={filters.sortBy || 'newest'} onChange={(event) => set('sortBy', event.target.value)} className={inputClass}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="highest_amount">Highest amount</option>
              <option value="lowest_amount">Lowest amount</option>
              <option value="a_z">A-Z</option>
              <option value="z_a">Z-A</option>
            </select>
          </div>
        )}

        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.map(([key, text]) => (
              <button
                key={key}
                type="button"
                onClick={() => set(key, '')}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700"
              >
                {text}<X className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
