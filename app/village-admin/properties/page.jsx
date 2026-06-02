'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import DashboardShell from '@/components/layout/DashboardShell';
import { getManageableVillages } from '@/lib/villages/getManageableVillages';
import { 
  Building, 
  Search, 
  SlidersHorizontal, 
  ExternalLink,
  Loader2,
  Compass,
  Sun,
  ShieldAlert,
  Coins
} from 'lucide-react';
import Link from 'next/link';

export default function VillageAdminPropertiesPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState([]);
  const [villages, setVillages] = useState([]);
  const [selectedVillageId, setSelectedVillageId] = useState('');
  
  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const fetchProperties = useCallback(async (villageId) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('village_id', villageId)
        .order('block_number', { ascending: true })
        .order('lot_number', { ascending: true });

      if (!error && data) {
        setProperties(data);
      }
    } catch (err) {
      console.error('Error loading properties list:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const fetchInitData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const vList = await getManageableVillages(supabase, user.id);
      setVillages(vList);

      if (vList.length > 0) {
        setSelectedVillageId(vList[0].id);
        await fetchProperties(vList[0].id);
      }
    } catch (err) {
      console.error('Error fetching properties setup data:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, fetchProperties]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInitData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchInitData]);

  const handleVillageChange = (e) => {
    const vId = e.target.value;
    setSelectedVillageId(vId);
    fetchProperties(vId);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'reserved':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'sold':
        return 'bg-red-500/10 text-red-400 border border-red-500/20';
      case 'under_maintenance':
        return 'bg-slate-500/10 text-slate-400 border border-slate-550';
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-550';
    }
  };

  // Filter properties locally
  const filteredProperties = properties.filter((p) => {
    const matchesSearch = p.property_code?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      `b${p.block_number}l${p.lot_number}`.toLowerCase().includes(searchQuery.toLowerCase().replace(/\s/g, ''));
    const matchesStatus = statusFilter ? p.status === statusFilter : true;
    const matchesType = typeFilter ? p.property_type === typeFilter : true;
    return matchesSearch && matchesStatus && matchesType;
  });

  if (loading && villages.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
          <div>
            <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
              <Building className="w-8 h-8 text-emerald-400" />
              Properties Inventory
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Browse, search, and manage individual lot boundaries, pricing lists, and availability specifications.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider select-none">Scope:</span>
            <select
              value={selectedVillageId}
              onChange={handleVillageChange}
              disabled={villages.length === 0}
              className="bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-4 text-xs font-semibold outline-none text-slate-200 cursor-pointer shadow"
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

        {/* Filters Tool bar */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow glass-card grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by lot code or block/lot (e.g. B1L2)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/50 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-200 outline-none placeholder-slate-650"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-350 outline-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="sold">Sold Out</option>
              <option value="under_maintenance">Maintenance</option>
            </select>
          </div>

          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-350 outline-none cursor-pointer"
            >
              <option value="">All Lot Types</option>
              <option value="house_and_lot">House & Lot</option>
              <option value="lot">Lot Only</option>
              <option value="townhouse">Townhouse</option>
              <option value="duplex">Duplex</option>
              <option value="commercial_lot">Commercial</option>
            </select>
          </div>
        </div>

        {/* Properties inventory Table */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 glass-card shadow">
          {loading ? (
            <div className="py-12 flex justify-center text-slate-400">
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Building className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-slate-450">No lots found matching query</h4>
              <p className="text-[11px] mt-1">Try expanding your filters or search keywords.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 select-none uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3">Lot Code</th>
                    <th className="py-3 px-3">Location Block/Lot</th>
                    <th className="py-3 px-3">Property Model</th>
                    <th className="py-3 px-3">Size Area</th>
                    <th className="py-3 px-3">Acquisition Price</th>
                    <th className="py-3 px-3">Hazards & Climate</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-slate-300">
                  {filteredProperties.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-950/20 transition-colors">
                      <td className="py-3.5 px-3 font-extrabold text-white">{p.property_code}</td>
                      <td className="py-3.5 px-3 text-slate-400">Block {p.block_number} Lot {p.lot_number}</td>
                      <td className="py-3.5 px-3">
                        <span className="text-slate-200 block">{p.model_name || 'Premium Lot Only'}</span>
                        <span className="text-[10px] text-slate-500 capitalize">{p.property_type?.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-350">
                        {p.lot_size} sqm
                        {p.floor_area > 0 && <span className="text-[10px] text-slate-500 block">Floor: {p.floor_area} sqm</span>}
                      </td>
                      <td className="py-3.5 px-3 font-bold text-white">
                        ₱{p.price?.toLocaleString()}
                        <span className="text-[10px] text-emerald-400 block font-normal flex items-center gap-0.5">
                          <Coins className="w-3 h-3" /> Dep: ₱{p.reservation_fee?.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                          <ShieldAlert className={`w-3.5 h-3.5 ${p.flood_risk === 'high' ? 'text-red-400' : p.flood_risk === 'medium' ? 'text-amber-400' : 'text-emerald-400'}`} />
                          <span>Flood: <span className="capitalize">{p.flood_risk}</span></span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                          <Sun className="w-3.5 h-3.5 text-amber-400" />
                          <span>Sunlight: <span className="capitalize">{p.sunlight_exposure}</span></span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full select-none ${getStatusColor(p.status)}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <Link
                          href="/village-admin/dashboard"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-950 border border-slate-850 hover:border-emerald-500/30 hover:bg-slate-800/30 text-emerald-400 font-bold rounded-lg transition"
                        >
                          Modify live
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </DashboardShell>
  );
}
