'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import DashboardShell from '@/components/layout/DashboardShell';
import { Map, Loader2 } from 'lucide-react';

const InteractiveVillageMap = dynamic(
  () => import('@/components/public/InteractiveVillageMap'),
  { ssr: false }
);

export default function VillageAdminBlueprintPreviewPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [villages, setVillages] = useState([]);
  const [selectedVillageId, setSelectedVillageId] = useState('');
  const [selectedVillageSlug, setSelectedVillageSlug] = useState('');

  const fetchInitData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch user villages to find assigned scope
      const { data: uv } = await supabase
        .from('user_villages')
        .select('*, villages(*)')
        .eq('user_id', user.id);

      const uvList = uv || [];
      const vList = uvList.map(item => item.villages).filter(Boolean);
      setVillages(vList);

      if (vList.length > 0) {
        setSelectedVillageId(vList[0].id);
        setSelectedVillageSlug(vList[0].slug);
      }
    } catch (err) {
      console.error('Error fetching villages for map preview:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInitData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchInitData]);

  const handleVillageChange = (e) => {
    const vId = e.target.value;
    setSelectedVillageId(vId);
    const matched = villages.find(v => v.id === vId);
    if (matched) {
      setSelectedVillageSlug(matched.slug);
    }
  };

  if (loading && villages.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  // Pre-configured mock village slug for viewports if empty
  const currentSlug = selectedVillageSlug || 'emerald-ridge';

  return (
    <DashboardShell>
      <div className="space-y-6">
        
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
          <div>
            <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
              <Map className="w-8 h-8 text-emerald-400" />
              Blueprint Preview Viewport
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Explore the buyer-facing interactive canvas map including standard searches, status legends, sunlight exposures, and flood risk warning layers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider select-none">Scope:</span>
            <select
              value={selectedVillageId}
              onChange={handleVillageChange}
              className="bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-4 text-xs font-semibold outline-none text-slate-200 cursor-pointer shadow"
            >
              {villages.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Blueprint stage */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 glass-card shadow min-h-[500px]">
          <InteractiveVillageMap 
            key={selectedVillageId} 
            villageSlug={currentSlug} 
            hideSidebar={false} 
          />
        </div>

      </div>
    </DashboardShell>
  );
}
