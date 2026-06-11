'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import DashboardShell from '@/components/layout/DashboardShell';
import PropertyEditorDrawer from '@/components/admin/PropertyEditorDrawer';
import AmenityEditorDrawer from '@/components/admin/AmenityEditorDrawer';
import { getManageableVillages } from '@/lib/villages/getManageableVillages';
import { isAmenityObject } from '@/lib/blueprints/amenities';
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
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [selectedObject, setSelectedObject] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [amenityDrawerOpen, setAmenityDrawerOpen] = useState(false);
  const [mapVersion, setMapVersion] = useState(0);

  const fetchInitData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      setIsSuperAdmin(profile?.role === 'super_admin');

      const vList = await getManageableVillages(supabase, user.id);
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
    setSelectedObject(null);
    setSelectedProperty(null);
    setDrawerOpen(false);
    setAmenityDrawerOpen(false);
  };

  const handleObjectSelect = (blueprintObject, property) => {
    setSelectedObject(blueprintObject);
    setSelectedProperty(property || null);
    if (isAmenityObject(blueprintObject)) {
      setAmenityDrawerOpen(true);
      setDrawerOpen(false);
    } else {
      setDrawerOpen(true);
      setAmenityDrawerOpen(false);
    }
  };

  const refreshMap = () => {
    setMapVersion((version) => version + 1);
    setDrawerOpen(false);
    setAmenityDrawerOpen(false);
    setSelectedObject(null);
    setSelectedProperty(null);
  };

  if (loading && villages.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  const currentSlug = selectedVillageSlug;

  return (
    <DashboardShell>
      <div className="space-y-6">
        
        {/* Header Title */}
        <div className="flex flex-col gap-4 border-b border-[#e2e8f0] pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-extrabold text-[#272727]">
              <Map className="w-8 h-8 text-emerald-400" />
              Blueprint Preview Viewport
            </h1>
            <p className="mt-1 text-xs text-[#64748b]">
              Preview the subdivision map, update linked property details, and manage customer-facing amenity information and photos.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="select-none text-xs font-semibold uppercase tracking-wider text-[#64748b]">Village:</span>
            <select
              value={selectedVillageId}
              onChange={handleVillageChange}
              disabled={villages.length === 0}
              className="cursor-pointer rounded-lg border border-[#dbe4ee] bg-white px-4 py-2.5 text-xs font-semibold text-[#272727] shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
            >
              {villages.length === 0 ? (
                <option value="">No active villages found</option>
              ) : (
                villages.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Blueprint stage */}
        <div className="min-h-[500px] rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
          {currentSlug ? (
            <InteractiveVillageMap 
              key={`${selectedVillageId}-${mapVersion}`}
              villageSlug={currentSlug} 
              hideSidebar={false} 
              allowDemoFallback={false}
              adminPropertyMode={true}
              adminShowHidden={true}
              preferDraftBlueprint={false}
              showSmartAssistant={false}
              onAdminObjectSelect={handleObjectSelect}
            />
          ) : (
            <div className="min-h-[500px] flex items-center justify-center text-center p-8">
              <div>
                <Map className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-slate-400">No Active Village Found</h4>
                <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                  Add or activate a village in the database to preview its buyer-facing map.
                </p>
              </div>
            </div>
          )}
        </div>

        <PropertyEditorDrawer
          open={drawerOpen}
          villageId={selectedVillageId}
          blueprintObject={selectedObject}
          property={selectedProperty}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setDrawerOpen(false)}
          onSaved={refreshMap}
          onDeleted={refreshMap}
        />

        {amenityDrawerOpen && selectedObject && (
          <AmenityEditorDrawer
            key={selectedObject.id}
            open
            villageId={selectedVillageId}
            blueprintObject={selectedObject}
            onClose={() => setAmenityDrawerOpen(false)}
            onSaved={refreshMap}
          />
        )}

      </div>
    </DashboardShell>
  );
}
