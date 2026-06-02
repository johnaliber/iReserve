'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, Loader2, Save } from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import { createClient } from '@/lib/supabase/client';

const inputClass = 'w-full rounded-lg border border-[#dbe4ee] bg-white px-3 py-2 text-sm text-[#272727] shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15';

export default function CustomerViewHubPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [villages, setVillages] = useState([]);

  const fetchVillages = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('villages')
        .select('*')
        .order('name', { ascending: true });
      setVillages(data || []);
    } catch (err) {
      console.error('Error loading customer view hub:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVillages();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchVillages]);

  const updateVillage = (id, field, value) => {
    setVillages((current) => current.map((village) => (
      village.id === id ? { ...village, [field]: value } : village
    )));
  };

  const saveVillage = async (village) => {
    setSavingId(village.id);
    try {
      const { error } = await supabase
        .from('villages')
        .update({
          status: village.status,
          description: village.description,
          hero_image_url: village.hero_image_url,
          starting_price: Number(village.starting_price || 0),
          updated_at: new Date().toISOString()
        })
        .eq('id', village.id);

      if (error) throw error;
      await fetchVillages();
    } catch (err) {
      alert(err.message || 'Village homepage settings could not be saved.');
    } finally {
      setSavingId('');
    }
  };

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex min-h-[520px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div className="flex flex-col gap-4 border-b border-[#e2e8f0] pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-600">Customer Experience</p>
            <h1 className="mt-2 text-3xl font-extrabold text-[#272727]">Customer View Hub</h1>
            <p className="mt-1 max-w-2xl text-sm text-[#64748b]">
              Enable or disable villages on the public homepage and edit customer-facing hero content without touching code.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#dbe4ee] bg-white px-4 py-2.5 text-sm font-bold text-[#272727] shadow-sm transition hover:bg-[#f8fafc]"
          >
            <Eye className="h-4 w-4 text-emerald-600" />
            Open Homepage
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5">
          {villages.map((village) => (
            <div key={village.id} className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_1fr_auto] lg:items-start">
                <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-[#f8fafc]">
                  <div
                    className="h-36 bg-cover bg-center"
                    style={{ backgroundImage: `url(${village.hero_image_url || 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=600&q=80'})` }}
                  />
                  <div className="p-3">
                    <p className="truncate text-sm font-extrabold text-[#272727]">{village.name}</p>
                    <p className="text-xs text-[#64748b]">{village.city}, {village.province}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label>
                    <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#64748b]">Homepage Status</span>
                    <select className={inputClass} value={village.status} onChange={(e) => updateVillage(village.id, 'status', e.target.value)}>
                      <option value="active">Enabled on homepage</option>
                      <option value="inactive">Disabled</option>
                      <option value="archived">Archived</option>
                    </select>
                  </label>
                  <label>
                    <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#64748b]">Starting Price</span>
                    <input className={inputClass} type="number" value={village.starting_price || 0} onChange={(e) => updateVillage(village.id, 'starting_price', e.target.value)} />
                  </label>
                  <label className="md:col-span-2">
                    <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#64748b]">Hero Image URL</span>
                    <input className={inputClass} value={village.hero_image_url || ''} onChange={(e) => updateVillage(village.id, 'hero_image_url', e.target.value)} />
                  </label>
                  <label className="md:col-span-2">
                    <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#64748b]">Homepage Description</span>
                    <textarea className={`${inputClass} min-h-24`} value={village.description || ''} onChange={(e) => updateVillage(village.id, 'description', e.target.value)} />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => saveVillage(village)}
                  disabled={savingId === village.id}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60"
                >
                  {savingId === village.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
