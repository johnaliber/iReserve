'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import DashboardShell from '@/components/layout/DashboardShell';
import { 
  PencilRuler, 
  Plus, 
  ArrowRight, 
  Loader2,
  CheckCircle2,
  Layers,
  Trash2
} from 'lucide-react';
import Link from 'next/link';

export default function ArchitectDashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [blueprintRows, setBlueprintRows] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [canCreateBlueprints, setCanCreateBlueprints] = useState(false);
  
  // Create Form State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedVillage, setSelectedVillage] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingBlueprintId, setDeletingBlueprintId] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchArchitectData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUser(user);

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const isSuperAdmin = profile?.role === 'super_admin';
      const isArchitect = profile?.role === 'architect';
      setCanCreateBlueprints(isSuperAdmin || isArchitect);

      let villages = [];

      if (isSuperAdmin) {
        const { data: allVillages, error: villagesError } = await supabase
          .from('villages')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (villagesError) throw villagesError;
        villages = allVillages || [];
      } else if (isArchitect) {
        const { data: uv, error: uvError } = await supabase
          .from('user_villages')
          .select('*, villages(*)')
          .eq('user_id', user.id)
          .eq('role', 'architect');

        if (uvError) throw uvError;
        villages = (uv || [])
          .map((item) => item.villages)
          .filter((village) => village?.status === 'active');
      }

      let blueprints = [];

      if (villages.length > 0) {
        const { data: bp, error: bpError } = await supabase
          .from('blueprints')
          .select('*')
          .in('village_id', villages.map((village) => village.id))
          .in('status', ['draft', 'published'])
          .order('created_at', { ascending: false });

        if (bpError) throw bpError;
        blueprints = bp || [];
      }

      const rows = villages.map((village) => {
        const latestBlueprint = blueprints.find((blueprint) => blueprint.village_id === village.id) || null;

        return {
          village,
          blueprint: latestBlueprint,
          hasBlueprint: Boolean(latestBlueprint),
          blueprintTitle: latestBlueprint ? latestBlueprint.name : 'No Blueprint Yet',
          version: latestBlueprint ? `v${latestBlueprint.version}` : '-',
          status: latestBlueprint ? latestBlueprint.status : 'no_blueprint',
          createdDate: latestBlueprint ? latestBlueprint.created_at : null
        };
      });

      setBlueprintRows(rows);

      const firstVillageWithoutBlueprint = rows.find((row) => !row.hasBlueprint)?.village.id || '';
      setSelectedVillage(firstVillageWithoutBlueprint);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error loading architect workspace.');
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

  const createBlueprintDraft = async (villageId, { redirectToEditor = false } = {}) => {
    if (!villageId) {
      setError('Please select a village.');
      return;
    }

    if (!currentUser || !canCreateBlueprints) {
      setError('Only super admin or architect users can create blueprint drafts.');
      return;
    }

    setCreating(true);
    setError('');
    setSuccessMsg('');

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .single();

      const isSuperAdmin = profile?.role === 'super_admin';
      const isArchitect = profile?.role === 'architect';

      if (!isSuperAdmin && !isArchitect) {
        throw new Error('Only super admin or architect users can create blueprint drafts.');
      }

      if (!isSuperAdmin) {
        const { data: access } = await supabase
          .from('user_villages')
          .select('id')
          .eq('user_id', currentUser.id)
          .eq('village_id', villageId)
          .eq('role', 'architect')
          .maybeSingle();

        if (!access) {
          throw new Error('You are not assigned as architect for this village.');
        }
      }

      const { data: existingBlueprint } = await supabase
        .from('blueprints')
        .select('id')
        .eq('village_id', villageId)
        .in('status', ['draft', 'published'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingBlueprint) {
        throw new Error('This village already has a blueprint.');
      }

      const { data: village, error: villageError } = await supabase
        .from('villages')
        .select('id, name')
        .eq('id', villageId)
        .single();

      if (villageError) throw villageError;

      const { data: blueprint, error: bpError } = await supabase
        .from('blueprints')
        .insert({
          village_id: villageId,
          name: `${village.name} Master Blueprint`,
          version: 1,
          status: 'draft',
          canvas_width: 3000,
          canvas_height: 2000,
          created_by: currentUser.id
        })
        .select()
        .single();

      if (bpError) throw bpError;

      await supabase.from('audit_logs').insert({
        user_id: currentUser.id,
        village_id: villageId,
        action: 'blueprint_draft_created',
        entity_type: 'blueprint',
        entity_id: blueprint.id,
        metadata: {
          blueprint_name: blueprint.name,
          version: blueprint.version
        }
      });

      setShowCreateForm(false);
      setSuccessMsg('Blueprint draft created successfully.');
      await fetchArchitectData();

      if (redirectToEditor) {
        router.push(`/architect/blueprints/${blueprint.id}/editor`);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error creating blueprint draft.');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateBlueprint = async (e) => {
    e.preventDefault();
    await createBlueprintDraft(selectedVillage, { redirectToEditor: false });
  };

  const deleteBlueprint = async (row) => {
    if (!row?.blueprint?.id || !currentUser) return;

    const confirmed = confirm(
      `Delete "${row.blueprint.name}"?\n\nThis will remove the blueprint and its canvas objects. The village will remain available so you can create a new draft later.`
    );

    if (!confirmed) return;

    setDeletingBlueprintId(row.blueprint.id);
    setError('');
    setSuccessMsg('');

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .single();

      const isSuperAdmin = profile?.role === 'super_admin';
      const isArchitect = profile?.role === 'architect';

      if (!isSuperAdmin && !isArchitect) {
        throw new Error('Only super admin or architect users can delete blueprints.');
      }

      if (!isSuperAdmin) {
        const { data: access } = await supabase
          .from('user_villages')
          .select('id')
          .eq('user_id', currentUser.id)
          .eq('village_id', row.village.id)
          .eq('role', 'architect')
          .maybeSingle();

        if (!access) {
          throw new Error('You are not assigned as architect for this village.');
        }
      }

      const { error: deleteObjectsError } = await supabase
        .from('blueprint_objects')
        .delete()
        .eq('blueprint_id', row.blueprint.id);

      if (deleteObjectsError) throw deleteObjectsError;

      const { error: deleteBlueprintError } = await supabase
        .from('blueprints')
        .delete()
        .eq('id', row.blueprint.id);

      if (deleteBlueprintError) throw deleteBlueprintError;

      await supabase.from('audit_logs').insert({
        user_id: currentUser.id,
        village_id: row.village.id,
        action: 'blueprint_deleted',
        entity_type: 'blueprint',
        entity_id: row.blueprint.id,
        metadata: {
          blueprint_name: row.blueprint.name,
          status: row.blueprint.status,
          version: row.blueprint.version
        }
      });

      setSuccessMsg('Blueprint deleted successfully.');
      await fetchArchitectData();
    } catch (err) {
      console.error('Error deleting blueprint:', err);
      setError(err.message || 'Error deleting blueprint.');
    } finally {
      setDeletingBlueprintId('');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'published':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'draft':
        return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
      default:
        return 'bg-slate-500/10 text-slate-500 border border-slate-500/20';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'published':
        return 'Published';
      case 'draft':
        return 'Draft';
      default:
        return 'No Blueprint Yet';
    }
  };

  const villagesWithoutBlueprints = blueprintRows.filter((row) => !row.hasBlueprint);

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
            onClick={() => {
              setError('');
              setShowCreateForm(!showCreateForm);
            }}
            disabled={!canCreateBlueprints || villagesWithoutBlueprints.length === 0}
            className="self-start md:self-auto flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl transition shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title={villagesWithoutBlueprints.length === 0 ? 'All villages already have blueprints.' : 'Create blueprint draft'}
          >
            <Plus className="w-4 h-4" />
            Create Blueprint Draft
          </button>
        </div>

        {successMsg && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            {successMsg}
          </div>
        )}

        {error && !showCreateForm && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
            {error}
          </div>
        )}

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

            {villagesWithoutBlueprints.length === 0 ? (
              <div className="p-3 rounded-lg bg-slate-500/10 border border-slate-500/20 text-slate-500 text-xs font-semibold">
                All villages already have blueprints.
              </div>
            ) : (
              <form onSubmit={handleCreateBlueprint} className="space-y-4">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Village Without Blueprint</label>
                  <select
                    value={selectedVillage}
                    onChange={(e) => setSelectedVillage(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2 px-3 text-slate-200 outline-none text-xs cursor-pointer"
                  >
                    {villagesWithoutBlueprints.map(({ village }) => (
                      <option key={village.id} value={village.id}>
                        {village.name}
                      </option>
                    ))}
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
                    disabled={creating || !selectedVillage}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs py-2 px-5 rounded-xl transition outline-none cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Create Draft
                  </button>
                </div>
              </form>
            )}
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
                {blueprintRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">
                      No active villages available for this architect workspace.
                    </td>
                  </tr>
                ) : (
                  blueprintRows.map((row) => (
                    <tr key={row.village.id} className="hover:bg-slate-950/20 transition-colors">
                      <td className="py-3.5 px-2 font-semibold text-white">{row.blueprintTitle}</td>
                      <td className="py-3.5 px-2 text-slate-400">{row.village.name}</td>
                      <td className="py-3.5 px-2 text-slate-400">{row.version}</td>
                      <td className="py-3.5 px-2">
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${getStatusBadge(row.status)}`}>
                          {getStatusLabel(row.status)}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-slate-500">
                        {row.createdDate ? new Date(row.createdDate).toLocaleDateString() : '-'}
                      </td>
                      <td className="py-3.5 px-2 text-right">
                        {row.hasBlueprint ? (
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/architect/blueprints/${row.blueprint.id}/editor`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-950 border border-slate-850 hover:border-emerald-500/30 hover:bg-slate-800/30 text-emerald-400 font-bold rounded-lg transition"
                            >
                              Launch Editor
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => deleteBlueprint(row)}
                              disabled={deletingBlueprintId === row.blueprint.id || !canCreateBlueprints}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 font-bold rounded-lg transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete blueprint"
                            >
                              {deletingBlueprintId === row.blueprint.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                              Delete
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => createBlueprintDraft(row.village.id, { redirectToEditor: true })}
                            disabled={creating || !canCreateBlueprints}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Create Draft
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </DashboardShell>
  );
}
