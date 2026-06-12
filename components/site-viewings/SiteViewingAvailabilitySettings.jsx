'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, Clock, Loader2, Users } from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import { createClient } from '@/lib/supabase/client';
import { getManageableVillages } from '@/lib/villages/getManageableVillages';
import AvailabilityCalendar, { toDateKey } from './AvailabilityCalendar';

function shortTime(value) {
  return value ? value.slice(0, 5) : '';
}

export default function SiteViewingAvailabilitySettings() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [villages, setVillages] = useState([]);
  const [selectedVillageId, setSelectedVillageId] = useState('');
  const [availability, setAvailability] = useState([]);
  const [error, setError] = useState('');
  const [defaults, setDefaults] = useState({
    startTime: '08:00',
    endTime: '17:00',
    dailyCapacity: 8
  });

  const fetchAvailability = useCallback(async (villageId) => {
    if (!villageId) {
      setAvailability([]);
      return;
    }

    const { data, error: queryError } = await supabase
      .from('site_viewing_availability')
      .select('*')
      .eq('village_id', villageId)
      .gte('available_date', toDateKey(new Date()))
      .order('available_date', { ascending: true });

    if (queryError) throw queryError;
    setAvailability(data || []);
  }, [supabase]);

  useEffect(() => {
    async function load() {
      try {
        const {
          data: { user }
        } = await supabase.auth.getUser();
        if (!user) return;

        const manageableVillages = await getManageableVillages(supabase, user.id);
        setVillages(manageableVillages);

        const firstVillageId = manageableVillages[0]?.id || '';
        setSelectedVillageId(firstVillageId);
        await fetchAvailability(firstVillageId);
      } catch (loadError) {
        setError(loadError.message || 'Site viewing availability could not be loaded.');
      } finally {
        setLoading(false);
      }
    }

    Promise.resolve().then(load);
  }, [fetchAvailability, supabase]);

  const handleVillageChange = async (event) => {
    const villageId = event.target.value;
    setSelectedVillageId(villageId);
    setError('');
    setLoading(true);
    try {
      await fetchAvailability(villageId);
    } catch (loadError) {
      setError(loadError.message || 'Site viewing availability could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDate = async (dateKey, isAvailable) => {
    setError('');
    const existingItem = availability.find((item) => item.available_date === dateKey);
    let optimisticItem = null;

    try {
      if (isAvailable) {
        setAvailability((current) => current.filter((item) => item.available_date !== dateKey));

        const { error: deleteError } = await supabase
          .from('site_viewing_availability')
          .delete()
          .eq('village_id', selectedVillageId)
          .eq('available_date', dateKey);

        if (deleteError) throw deleteError;
      } else {
        if (defaults.startTime >= defaults.endTime) {
          throw new Error('The closing time must be later than the opening time.');
        }

        const {
          data: { user }
        } = await supabase.auth.getUser();

        optimisticItem = {
          id: `pending-${dateKey}`,
          village_id: selectedVillageId,
          available_date: dateKey,
          start_time: defaults.startTime,
          end_time: defaults.endTime,
          daily_capacity: Number(defaults.dailyCapacity),
          created_by: user?.id || null
        };
        setAvailability((current) => (
          [...current, optimisticItem].sort((left, right) => left.available_date.localeCompare(right.available_date))
        ));

        const { data: created, error: insertError } = await supabase
          .from('site_viewing_availability')
          .insert({
            village_id: optimisticItem.village_id,
            available_date: optimisticItem.available_date,
            start_time: optimisticItem.start_time,
            end_time: optimisticItem.end_time,
            daily_capacity: optimisticItem.daily_capacity,
            created_by: optimisticItem.created_by
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setAvailability((current) => current.map((item) => (
          item.id === optimisticItem.id ? created : item
        )));
      }
    } catch (saveError) {
      setAvailability((current) => {
        const withoutDate = current.filter((item) => item.available_date !== dateKey);
        return existingItem
          ? [...withoutDate, existingItem].sort((left, right) => left.available_date.localeCompare(right.available_date))
          : withoutDate;
      });
      setError(saveError.message || 'The selected date could not be updated.');
    }
  };

  const upcomingDates = useMemo(() => availability.slice(0, 8), [availability]);

  if (loading && villages.length === 0) {
    return (
      <DashboardShell>
        <div className="flex min-h-[420px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 border-b border-[#e2e8f0] pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-extrabold text-[#272727]">
              <CalendarDays className="h-8 w-8 text-emerald-500" />
              Site Viewing Calendar
            </h1>
            <p className="mt-1 text-sm text-[#64748b]">
              Publish the dates customers may select when requesting a property viewing.
            </p>
          </div>
          <label className="text-xs font-bold text-[#475569]">
            Village
            <select
              value={selectedVillageId}
              onChange={handleVillageChange}
              className="mt-1.5 block min-w-64 rounded-xl border border-[#dbe4ee] bg-white px-3 py-2.5 text-sm text-[#272727] outline-none focus:border-emerald-500"
            >
              {villages.map((village) => (
                <option key={village.id} value={village.id}>{village.name}</option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(320px,480px)_1fr]">
          <div>
            <AvailabilityCalendar editable availableDates={availability} onToggle={handleToggleDate} />
            <p className="mt-3 text-xs leading-5 text-[#64748b]">
              Click an unavailable date to open it. Click a green date to close it.
            </p>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-extrabold text-[#272727]">New Date Defaults</h2>
              <p className="mt-1 text-xs text-[#64748b]">These values apply when you open another calendar date.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <label className="text-xs font-bold text-[#475569]">
                  <Clock className="mb-1 inline h-3.5 w-3.5 text-emerald-500" /> Opens
                  <input
                    type="time"
                    value={defaults.startTime}
                    onChange={(event) => setDefaults((current) => ({ ...current, startTime: event.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-[#dbe4ee] px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                  />
                </label>
                <label className="text-xs font-bold text-[#475569]">
                  <Clock className="mb-1 inline h-3.5 w-3.5 text-emerald-500" /> Closes
                  <input
                    type="time"
                    value={defaults.endTime}
                    onChange={(event) => setDefaults((current) => ({ ...current, endTime: event.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-[#dbe4ee] px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                  />
                </label>
                <label className="text-xs font-bold text-[#475569]">
                  <Users className="mb-1 inline h-3.5 w-3.5 text-emerald-500" /> Daily Limit
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={defaults.dailyCapacity}
                    onChange={(event) => setDefaults((current) => ({ ...current, dailyCapacity: event.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-[#dbe4ee] px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-[#272727]">Upcoming Open Dates</h2>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700">
                  {availability.length} open
                </span>
              </div>
              {upcomingDates.length === 0 ? (
                <p className="mt-4 rounded-xl bg-[#f8fafc] p-4 text-sm text-[#64748b]">
                  No dates are open yet. Select dates from the calendar to publish them.
                </p>
              ) : (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {upcomingDates.map((item) => (
                    <div key={item.id} className="rounded-xl border border-[#e2e8f0] p-3">
                      <p className="text-sm font-extrabold text-[#272727]">
                        {new Date(`${item.available_date}T00:00:00`).toLocaleDateString('en-PH', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                      <p className="mt-1 text-xs text-[#64748b]">
                        {shortTime(item.start_time)}-{shortTime(item.end_time)} · {item.daily_capacity} appointments
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
