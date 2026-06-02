'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import DashboardShell from '@/components/layout/DashboardShell';
import { 
  PencilRuler, 
  Plus, 
  Map, 
  Calendar, 
  FileText, 
  Building, 
  ArrowRight, 
  Loader2,
  CheckCircle2,
  Layers
} from 'lucide-react';
import Link from 'next/link';

export default function ArchitectDashboardPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [blueprints, setBlueprints] = useState([]);
  const [userVillages, setUserVillages] = useState([]);
  
  // Create Form State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [bpName, setBpName] = useState('');
  const [selectedVillage, setSelectedVillage] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const fetchArchitectData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch user villages mappings
      const { data: uv } = await supabase
        .from('user_villages')
        .select('*, villages(id, name)')
        .eq('user_id', user.id);
      
      const mappedVillages = uv || [];
      setUserVillages(mappedVillages);
      if (mappedVillages.length > 0) {
        setSelectedVillage(mappedVillages[0].village_id);
      }

      // 2. Fetch blueprints
      const { data: bp } = await supabase
        .from('blueprints')
        .select('*, villages(name)');
      
      setBlueprints(bp || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchArchitectData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchArchitectData]);

  const handleCreateBlueprint = async (e) => {
    e.preventDefault();
    if (!bpName || !selectedVillage) {
      setError('Please provide a name and assign a village.');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: newBp, error: bpError } = await supabase
        .from('blueprints')
        .insert({
          name: bpName,
          village_id: selectedVillage,
          status: 'draft',
          version: 1,
          canvas_width: 2000,
          canvas_height: 2000,
          created_by: user.id
        })
        .select()
        .single();

      if (bpError) throw bpError;

      // Pre-seed some default roads to make editor visualization pleasant on open
      const { error: seedError } = await supabase
        .from('blueprint_objects')
        .insert([
          {
            village_id: selectedVillage,
            blueprint_id: newBp.id,
            object_type: 'road',
            object_data: { name: 'Boulevard Road', roadType: 'main', points: [100, 300, 800, 300], width: 40, borderThickness: 6, asphaltColor: '#e2e8f0', borderColor: '#334155' },
            layer_order: 1
          }
        ]);

      setBpName('');
      setShowCreateForm(false);
      fetchArchitectData();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error creating blueprint draft.');
    } finally {
      setCreating(false);
    }
  };

  // Fallback demo blueprint if none exist in local setup yet
  const getMockBlueprints = () => [
    { id: 'mock-bp-1', name: 'Emerald Subdivision Phase 1 Layout', version: 1, status: 'published', villages: { name: 'Emerald Ridge Heights' }, created_at: new Date().toISOString() },
    { id: 'mock-bp-2', name: 'Lagoon Lake Side Trails Vector', version: 2, status: 'draft', villages: { name: 'Teal Lagoon Residences' }, created_at: new Date().toISOString() }
  ];

  const displayedBlueprints = blueprints.length > 0 ? blueprints : getMockBlueprints();

  if (loading) {
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
              <PencilRuler className="w-8 h-8 text-emerald-400" />
              Architect Design Workspace
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Create, edit, snap roads, map zones, and publish vector layouts for your assigned subdivisions.
            </p>
          </div>

          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="self-start md:self-auto flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl transition shadow cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Blueprint Draft
          </button>
        </div>

        {/* Create Form Modal/Box Overlay */}
        {showCreateForm && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 glass-card space-y-4 max-w-lg">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              New Blueprint Draft Setup
            </h3>
            
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateBlueprint} className="space-y-4">
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Blueprint Draft Name</label>
                <input
                  type="text"
                  required
                  value={bpName}
                  onChange={(e) => setBpName(e.target.value)}
                  placeholder="e.g. Ridge View Subdivision Phase 3"
                  className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/60 rounded-xl py-2 px-3 text-slate-200 placeholder-slate-650 outline-none text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Assign to Subdivisions Village</label>
                <select
                  value={selectedVillage}
                  onChange={(e) => setSelectedVillage(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2 px-3 text-slate-200 outline-none text-xs cursor-pointer"
                >
                  {userVillages.length === 0 ? (
                    <>
                      <option value="mock-v1">Emerald Ridge Heights (Demo scope)</option>
                      <option value="mock-v2">Teal Lagoon Residences (Demo scope)</option>
                    </>
                  ) : (
                    userVillages.map(uv => (
                      <option key={uv.village_id} value={uv.village_id}>
                        {uv.villages?.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="py-2 px-4 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-semibold outline-none cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs py-2 px-5 rounded-xl transition outline-none cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Generate Draft
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Blueprints Grid Table */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 glass-card space-y-4">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4.5 h-4.5 text-emerald-400" />
            Vector Subdivision Blueprints
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 select-none">
                  <th className="py-3 px-2">Blueprint Title</th>
                  <th className="py-3 px-2">Village Scope</th>
                  <th className="py-3 px-2">Version</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2">Created Date</th>
                  <th className="py-3 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {displayedBlueprints.map((bp) => (
                  <tr key={bp.id} className="hover:bg-slate-950/20 transition-colors">
                    <td className="py-3.5 px-2 font-semibold text-white">{bp.name}</td>
                    <td className="py-3.5 px-2 text-slate-400">{bp.villages?.name || 'Smart Village'}</td>
                    <td className="py-3.5 px-2 text-slate-400">v{bp.version}</td>
                    <td className="py-3.5 px-2">
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                        bp.status === 'published' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {bp.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-2 text-slate-500">{new Date(bp.created_at).toLocaleDateString()}</td>
                    <td className="py-3.5 px-2 text-right">
                      <Link
                        href={`/architect/blueprints/${bp.id}/editor`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-950 border border-slate-850 hover:border-emerald-500/30 hover:bg-slate-800/30 text-emerald-400 font-bold rounded-lg transition"
                      >
                        Launch Editor
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </DashboardShell>
  );
}
