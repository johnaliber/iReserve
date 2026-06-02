'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import DashboardShell from '@/components/layout/DashboardShell';
const InteractiveVillageMap = dynamic(() => import('@/components/public/InteractiveVillageMap'), { ssr: false });
import { 
  Building, 
  Settings, 
  Map, 
  Inbox, 
  Calendar, 
  Coins, 
  Save,
  Loader2,
  CheckCircle2,
  Info,
  Compass,
  Sun,
  ShieldAlert
} from 'lucide-react';

export default function VillageAdminDashboardPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [userVillages, setUserVillages] = useState([]);
  const [selectedVillageId, setSelectedVillageId] = useState('');
  const [selectedVillageSlug, setSelectedVillageSlug] = useState('');
  const [properties, setProperties] = useState([]);
  
  // Dashboard Analytics
  const [stats, setStats] = useState({
    total: 0,
    available: 0,
    reserved: 0,
    sold: 0
  });

  // Split-Pane Inspector Form State
  const [activeProperty, setActiveProperty] = useState(null);
  const [savingSpecs, setSavingSpecs] = useState(false);
  const [deletingProp, setDeletingProp] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Editable Form fields
  const [modelName, setModelName] = useState('');
  const [price, setPrice] = useState(0);
  const [reserveFee, setReserveFee] = useState(0);
  const [status, setStatus] = useState('available');
  const [orientation, setOrientation] = useState('');
  const [floodRisk, setFloodRisk] = useState('low');
  const [sunlight, setSunlight] = useState('balanced');
  const [lotSize, setLotSize] = useState(0);
  const [floorArea, setFloorArea] = useState(0);
  const [bedrooms, setBedrooms] = useState(0);
  const [bathrooms, setBathrooms] = useState(0);
  const [description, setDescription] = useState('');

  const handleSelectVillage = useCallback(async (villageId, slug) => {
    setSelectedVillageId(villageId);
    setSelectedVillageSlug(slug);
    setActiveProperty(null);

    // Fetch properties and compute stats
    try {
      const { data } = await supabase
        .from('properties')
        .select('*')
        .eq('village_id', villageId);

      const list = data || [];
      setProperties(list);

      setStats({
        total: list.length,
        available: list.filter(p => p.status === 'available').length,
        reserved: list.filter(p => p.status === 'reserved').length,
        sold: list.filter(p => p.status === 'sold').length
      });
    } catch (err) {
      console.error(err);
    }
  }, [supabase]);

  const fetchVillageAdminData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch assigned villages
      const { data: uv } = await supabase
        .from('user_villages')
        .select('*, villages(*)')
        .eq('user_id', user.id)
        .eq('role', 'village_admin');

      const mapped = uv || [];
      setUserVillages(mapped);

      if (mapped.length > 0) {
        handleSelectVillage(mapped[0].villages?.id, mapped[0].villages?.slug);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase, handleSelectVillage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVillageAdminData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchVillageAdminData]);

  // Click handler from the Blueprint stage
  const handlePropClickFromMap = (propertyId) => {
    const prop = properties.find(p => p.id === propertyId);
    if (prop) {
      setActiveProperty(prop);
      setModelName(prop.model_name || '');
      setPrice(prop.price || 0);
      setReserveFee(prop.reservation_fee || 5000);
      setStatus(prop.status || 'available');
      setOrientation(prop.orientation || '');
      setFloodRisk(prop.flood_risk || 'low');
      setSunlight(prop.sunlight_exposure || 'balanced');
      setLotSize(prop.lot_size || 0);
      setFloorArea(prop.floor_area || 0);
      setBedrooms(prop.bedrooms || 0);
      setBathrooms(prop.bathrooms || 0);
      setDescription(prop.description || '');
    }
  };

  // Submit spec updates
  const handleSaveSpecs = async (e) => {
    e.preventDefault();
    if (!activeProperty) return;

    setSavingSpecs(true);
    setSuccessMsg('');

    try {
      const { error } = await supabase
        .from('properties')
        .update({
          model_name: modelName,
          price,
          reservation_fee: reserveFee,
          status,
          orientation,
          flood_risk: floodRisk,
          sunlight_exposure: sunlight,
          lot_size: lotSize,
          floor_area: floorArea,
          bedrooms,
          bathrooms,
          description
        })
        .eq('id', activeProperty.id);

      if (error) throw error;

      setSuccessMsg('Property specifications updated successfully!');
      setTimeout(() => setSuccessMsg(''), 2500);

      // Refresh data
      handleSelectVillage(selectedVillageId, selectedVillageSlug);
    } catch (err) {
      alert(err.message || 'Error updating property coordinates.');
    } finally {
      setSavingSpecs(false);
    }
  };

  const handleDeleteProperty = async () => {
    if (!activeProperty) return;
    if (!confirm('Are you sure you want to delete this property lot? This will remove its linked visual object from maps.')) return;
    
    setDeletingProp(true);
    try {
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', activeProperty.id);
      
      if (error) throw error;
      
      setSuccessMsg('Property successfully deleted!');
      setTimeout(() => setSuccessMsg(''), 2500);
      
      // Clear selection
      setActiveProperty(null);
      // Refresh list
      handleSelectVillage(selectedVillageId, selectedVillageSlug);
    } catch (err) {
      alert(err.message || 'Error deleting property.');
    } finally {
      setDeletingProp(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  // Pre-configured mock villages for dashboard if empty
  const mockUserVillages = [
    { village_id: 'mock-1', villages: { id: 'mock-1', name: 'Emerald Ridge Heights', slug: 'emerald-ridge' } }
  ];

  const displayedVillages = userVillages.length > 0 ? userVillages : mockUserVillages;
  const currentSlug = selectedVillageSlug || displayedVillages[0].villages?.slug;

  return (
    <DashboardShell>
      <div className="space-y-6">
        
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
          <div>
            <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
              <Settings className="w-8 h-8 text-emerald-400" />
              Village Manager Dashboard
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Select your assigned village, preview layout blueprints, and manage price list listings directly from visual nodes.
            </p>
          </div>

          {/* Village Selector dropdown */}
          <select
            value={selectedVillageId}
            onChange={(e) => {
              const matched = displayedVillages.find(uv => uv.village_id === e.target.value);
              if (matched) {
                handleSelectVillage(matched.village_id, matched.villages?.slug);
              }
            }}
            className="bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-4 text-xs font-semibold outline-none text-slate-200 cursor-pointer shadow"
          >
            {displayedVillages.map(uv => (
              <option key={uv.village_id} value={uv.village_id}>
                {uv.villages?.name}
              </option>
            ))}
          </select>
        </div>

        {/* Village stats summaries */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-slate-850 bg-slate-900/60 shadow glass-card">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Lots</span>
            <span className="text-xl font-extrabold text-white mt-1 block">{stats.total || 24} lots</span>
          </div>
          <div className="p-4 rounded-xl border border-slate-850 bg-slate-900/60 shadow glass-card">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Available</span>
            <span className="text-xl font-extrabold text-emerald-400 mt-1 block">{stats.available || 12} lots</span>
          </div>
          <div className="p-4 rounded-xl border border-slate-850 bg-slate-900/60 shadow glass-card">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Reserved</span>
            <span className="text-xl font-extrabold text-amber-500 mt-1 block">{stats.reserved || 8} lots</span>
          </div>
          <div className="p-4 rounded-xl border border-slate-850 bg-slate-900/60 shadow glass-card">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Sold Out</span>
            <span className="text-xl font-extrabold text-red-500 mt-1 block">{stats.sold || 4} lots</span>
          </div>
        </div>

        {/* Split Pane: Left Map, Right Property Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          
          {/* Left Split: Visual map preview */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow glass-card flex flex-col justify-between">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <Map className="w-4.5 h-4.5 text-emerald-400" />
                Subdivision Blueprint Preview
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Click any available plot polygon to audit and edit property specifications live on the right panel.
              </p>
            </div>

            <div className="border border-slate-950 rounded-xl overflow-hidden bg-slate-950/30">
              {/* Force map re-rendering on village update */}
              <InteractiveVillageMap 
                key={selectedVillageId} 
                villageSlug={currentSlug} 
                onPropertySelect={handlePropClickFromMap} 
                hideSidebar={true} 
              />
            </div>
            
            {/* Manual List view in case they prefer table clicks */}
            <div className="mt-6 pt-4 border-t border-slate-850">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3">Or choose parcel from list:</span>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-1">
                {properties.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handlePropClickFromMap(p.id)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer outline-none ${
                      activeProperty?.id === p.id 
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                        : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    B{p.block_number}L{p.lot_number} ({p.status})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Split: Specifications Drawer Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow glass-card flex flex-col justify-between">
            {!activeProperty ? (
              <div className="flex-1 flex flex-col justify-center items-center text-center text-slate-500 select-none py-16">
                <Info className="w-10 h-10 mb-3 text-slate-700" />
                <h4 className="text-sm font-semibold text-slate-400">No Parcel Selected</h4>
                <p className="text-[11px] mt-1 leading-normal max-w-[180px] mx-auto">
                  Click a lot on the visual subdivision map to edit pricing, bedrooms, and status.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSaveSpecs} className="space-y-4 flex flex-col justify-between h-full">
                <div className="space-y-4">
                  <div className="border-b border-slate-800 pb-3">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Parcel Inspector</span>
                    <h3 className="text-lg font-bold text-white mt-0.5">
                      {activeProperty.property_code}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-semibold mt-1 uppercase">
                      Block {activeProperty.block_number} Lot {activeProperty.lot_number}
                    </p>
                  </div>

                  {successMsg && (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      {successMsg}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Model Name</label>
                      <input
                        type="text"
                        value={modelName}
                        onChange={(e) => setModelName(e.target.value)}
                        className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/50 rounded-lg p-2 outline-none text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Parcel Status</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-lg p-2 outline-none text-slate-200 cursor-pointer"
                      >
                        <option value="available">Available (Green)</option>
                        <option value="reserved">Reserved (Yellow)</option>
                        <option value="sold">Sold Out (Red)</option>
                        <option value="under_maintenance">Maintenance (Gray)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">List Price (₱)</label>
                      <input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/50 rounded-lg p-2 outline-none text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Hold Deposit (₱)</label>
                      <input
                        type="number"
                        value={reserveFee}
                        onChange={(e) => setReserveFee(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/50 rounded-lg p-2 outline-none text-slate-200"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-0.5">
                        <Compass className="w-3.5 h-3.5 text-emerald-400" />
                        Orientation
                      </label>
                      <input
                        type="text"
                        value={orientation}
                        onChange={(e) => setOrientation(e.target.value)}
                        placeholder="e.g. Facing East"
                        className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/50 rounded-lg p-2 outline-none text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-0.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                        Flood Risk
                      </label>
                      <select
                        value={floodRisk}
                        onChange={(e) => setFloodRisk(e.target.value)}
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-lg p-2 outline-none text-slate-200 cursor-pointer"
                      >
                        <option value="low">Low Risk</option>
                        <option value="medium">Medium Risk</option>
                        <option value="high">High Risk</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Lot Area (sqm)</label>
                      <input
                        type="number"
                        value={lotSize}
                        onChange={(e) => setLotSize(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/50 rounded-lg p-2 outline-none text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Floor Area (sqm)</label>
                      <input
                        type="number"
                        value={floorArea}
                        onChange={(e) => setFloorArea(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/50 rounded-lg p-2 outline-none text-slate-200"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 mt-6">
                  <button
                    type="submit"
                    disabled={savingSpecs || deletingProp}
                    className="flex-grow flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold py-3 px-4 rounded-xl shadow-lg transition duration-200 outline-none cursor-pointer disabled:opacity-50"
                  >
                    {savingSpecs ? (
                      <Loader2 className="w-4.5 h-4.5 animate-spin" />
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Update Specs
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteProperty}
                    disabled={savingSpecs || deletingProp}
                    className="py-3 px-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 font-bold transition outline-none cursor-pointer disabled:opacity-50"
                  >
                    {deletingProp ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Delete'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>

      </div>
    </DashboardShell>
  );
}
