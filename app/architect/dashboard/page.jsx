'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleDot,
  Clock3,
  Eye,
  Layers3,
  Loader2,
  Map,
  MapPinned,
  PencilRuler,
  Plus,
  Trash2,
  X
} from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import { createClient } from '@/lib/supabase/client';
import { useRealtimeBlueprint } from '@/lib/realtime/useRealtimeBlueprint';
import { useRealtimeRefresh } from '@/lib/realtime/useRealtimeRefresh';

const InteractiveVillageMap = dynamic(
  () => import('@/components/public/InteractiveVillageMap'),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[560px] items-center justify-center bg-[#eef3f0] text-[#64748b]">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#16835f]" />
        Loading village preview...
      </div>
    )
  }
);

function formatDate(value) {
  if (!value) return 'Not published';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(value));
}

function statusClasses(status) {
  if (status === 'published') {
    return 'border-[#86d5b4] bg-[#dcfce7] text-[#166534]';
  }

  if (status === 'draft') {
    return 'border-[#f4cf75] bg-[#fef3c7] text-[#92400e]';
  }

  return 'border-[#cbd5e1] bg-[#e2e8f0] text-[#1e293b]';
}

function StatCard({ icon: Icon, label, value, detail, accent = 'emerald' }) {
  const accents = {
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    violet: 'border-violet-100 bg-violet-50 text-violet-700'
  };

  return (
    <div className="group rounded-2xl border border-[#dfe7e3] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.035)] transition duration-200 hover:-translate-y-0.5 hover:border-[#c9d8d1] hover:shadow-[0_12px_30px_rgba(15,23,42,0.07)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.09em] text-[#475b52]">{label}</p>
          <p className="mt-3 text-3xl font-extrabold leading-none tracking-tight text-[#17211d]">{value}</p>
          <p className="mt-2 truncate text-xs font-semibold text-[#475b52]">{detail}</p>
        </div>
        <div className={`rounded-xl border p-3 transition-transform duration-200 group-hover:scale-105 ${accents[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function ArchitectDashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedVillageId, setSelectedVillageId] = useState('');
  const [canManageBlueprints, setCanManageBlueprints] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingBlueprintId, setDeletingBlueprintId] = useState('');
  const [previewVersion, setPreviewVersion] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchArchitectData = useCallback(async ({
    preserveSelection = true,
    showLoading = true
  } = {}) => {
    if (showLoading) setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }

      setCurrentUser(user);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      const isSuperAdmin = profile?.role === 'super_admin';
      const isArchitect = profile?.role === 'architect';
      setCanManageBlueprints(isSuperAdmin || isArchitect);

      let villages = [];

      if (isSuperAdmin) {
        const { data, error: villagesError } = await supabase
          .from('villages')
          .select('*')
          .eq('status', 'active')
          .order('name');

        if (villagesError) throw villagesError;
        villages = data || [];
      } else if (isArchitect) {
        const { data, error: accessError } = await supabase
          .from('user_villages')
          .select('villages(*)')
          .eq('user_id', user.id)
          .eq('role', 'architect');

        if (accessError) throw accessError;
        villages = (data || [])
          .map((item) => item.villages)
          .filter((village) => village?.status === 'active')
          .sort((a, b) => a.name.localeCompare(b.name));
      }

      const villageIds = villages.map((village) => village.id);
      let blueprints = [];
      let objects = [];
      let properties = [];

      if (villageIds.length > 0) {
        const [
          { data: blueprintData, error: blueprintError },
          { data: propertyData, error: propertyError }
        ] = await Promise.all([
          supabase
            .from('blueprints')
            .select('*')
            .in('village_id', villageIds)
            .in('status', ['draft', 'published'])
            .order('updated_at', { ascending: false }),
          supabase
            .from('properties')
            .select('id, village_id, status')
            .in('village_id', villageIds)
        ]);

        if (blueprintError) throw blueprintError;
        if (propertyError) throw propertyError;

        blueprints = blueprintData || [];
        properties = propertyData || [];

        if (blueprints.length > 0) {
          const { data: objectData, error: objectError } = await supabase
            .from('blueprint_objects')
            .select('id, blueprint_id, object_type, linked_property_id, is_visible')
            .in('blueprint_id', blueprints.map((blueprint) => blueprint.id));

          if (objectError) throw objectError;
          objects = objectData || [];
        }
      }

      const nextRows = villages.map((village) => {
        const blueprint = blueprints.find((item) => item.village_id === village.id) || null;
        const blueprintObjects = blueprint
          ? objects.filter((object) => object.blueprint_id === blueprint.id)
          : [];
        const villageProperties = properties.filter((property) => property.village_id === village.id);
        const lotObjects = blueprintObjects.filter((object) => ['lot', 'house'].includes(object.object_type));

        return {
          village,
          blueprint,
          objectCount: blueprintObjects.length,
          lotCount: lotObjects.length,
          linkedLotCount: lotObjects.filter((object) => object.linked_property_id).length,
          availableCount: villageProperties.filter((property) => property.status === 'available').length,
          reservedCount: villageProperties.filter((property) => property.status === 'reserved').length,
          soldCount: villageProperties.filter((property) => property.status === 'sold').length
        };
      });

      setRows(nextRows);
      setSelectedVillageId((current) => {
        if (preserveSelection && nextRows.some((row) => row.village.id === current)) {
          return current;
        }
        return nextRows[0]?.village.id || '';
      });
      setLastSyncedAt(new Date());
    } catch (err) {
      console.error('Error loading architect dashboard:', err);
      setError(err.message || 'Unable to load the architect dashboard.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchArchitectData({ preserveSelection: false });
    }, 0);

    return () => clearTimeout(timer);
  }, [fetchArchitectData]);

  const selectedRow = rows.find((row) => row.village.id === selectedVillageId) || rows[0] || null;
  const villagesWithoutBlueprints = rows.filter((row) => !row.blueprint);
  const openCreateForm = () => {
    const villageId = selectedRow && !selectedRow.blueprint
      ? selectedRow.village.id
      : villagesWithoutBlueprints[0]?.village.id;

    if (villageId) setSelectedVillageId(villageId);
    setShowCreateForm(true);
  };

  const refreshArchitectPreview = useCallback(() => {
    setPreviewVersion((version) => version + 1);
    setLastSyncedAt(new Date());
    fetchArchitectData({ showLoading: false });
  }, [fetchArchitectData]);
  const scheduleArchitectRefresh = useRealtimeRefresh(refreshArchitectPreview, 250);
  useRealtimeBlueprint({
    blueprintId: selectedRow?.blueprint?.id,
    onBlueprintChange: scheduleArchitectRefresh,
    onObjectChange: scheduleArchitectRefresh
  });

  const createBlueprintDraft = async (villageId, redirectToEditor = false) => {
    if (!villageId || !currentUser || !canManageBlueprints) return;

    setCreating(true);
    setError('');
    setSuccessMessage('');

    try {
      const targetRow = rows.find((row) => row.village.id === villageId);
      if (!targetRow) throw new Error('Village not found.');
      if (targetRow.blueprint) throw new Error('This village already has an active blueprint.');

      const { data: blueprint, error: blueprintError } = await supabase
        .from('blueprints')
        .insert({
          village_id: villageId,
          name: `${targetRow.village.name} Master Blueprint`,
          version: 1,
          status: 'draft',
          canvas_width: 3000,
          canvas_height: 2000,
          created_by: currentUser.id
        })
        .select()
        .single();

      if (blueprintError) throw blueprintError;

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

      setSelectedVillageId(villageId);
      setShowCreateForm(false);
      setSuccessMessage('Blueprint draft created.');
      await fetchArchitectData();

      if (redirectToEditor) {
        router.push(`/architect/blueprints/${blueprint.id}/editor`);
      }
    } catch (err) {
      console.error('Error creating blueprint:', err);
      setError(err.message || 'Unable to create the blueprint draft.');
    } finally {
      setCreating(false);
    }
  };

  const deleteBlueprint = async () => {
    if (!selectedRow?.blueprint || !currentUser) return;

    const confirmed = window.confirm(
      `Delete "${selectedRow.blueprint.name}"? This also removes its canvas objects.`
    );
    if (!confirmed) return;

    setDeletingBlueprintId(selectedRow.blueprint.id);
    setError('');
    setSuccessMessage('');

    try {
      const { error: deleteError } = await supabase
        .from('blueprints')
        .delete()
        .eq('id', selectedRow.blueprint.id);

      if (deleteError) throw deleteError;

      await supabase.from('audit_logs').insert({
        user_id: currentUser.id,
        village_id: selectedRow.village.id,
        action: 'blueprint_deleted',
        entity_type: 'blueprint',
        entity_id: selectedRow.blueprint.id,
        metadata: {
          blueprint_name: selectedRow.blueprint.name,
          status: selectedRow.blueprint.status,
          version: selectedRow.blueprint.version
        }
      });

      setSuccessMessage('Blueprint deleted.');
      setPreviewVersion((version) => version + 1);
      await fetchArchitectData();
    } catch (err) {
      console.error('Error deleting blueprint:', err);
      setError(err.message || 'Unable to delete the blueprint.');
    } finally {
      setDeletingBlueprintId('');
    }
  };

  if (loading && rows.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7f6] text-[#64748b]">
        <Loader2 className="mr-3 h-7 w-7 animate-spin text-[#16835f]" />
        Loading architect dashboard...
      </div>
    );
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-[1680px] space-y-6 pb-10">
        <header className="border-b border-[#dce7e2] pb-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="hidden h-11 w-11 shrink-0 items-center justify-center text-[#16835f] sm:flex">
                <MapPinned className="h-7 w-7" />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#16835f]">
                  <CircleDot className="h-3 w-3 fill-emerald-500 text-emerald-500" />
                  Architect workspace
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight text-[#17211d] sm:text-3xl">
                  Village Live Preview
                </h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-[#64748b]">
                  Monitor the active site plan, validate mapped inventory, and continue designing from one workspace.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#52635b]">
                  Village
                </span>
                <select
                  value={selectedRow?.village.id || ''}
                  onChange={(event) => {
                    setSelectedVillageId(event.target.value);
                    setPreviewVersion((version) => version + 1);
                  }}
                  disabled={rows.length === 0}
                  className="h-10 min-w-52 rounded-lg border border-[#cbd5e1] bg-white px-3 text-sm font-semibold text-[#223129] outline-none transition focus:border-[#16835f] focus:ring-2 focus:ring-emerald-500/10"
                  aria-label="Select village preview"
                >
                  {rows.length === 0 ? (
                    <option value="">No assigned villages</option>
                  ) : (
                    rows.map((row) => (
                      <option key={row.village.id} value={row.village.id}>
                        {row.village.name}
                      </option>
                    ))
                  )}
                </select>
              </label>

              {selectedRow?.blueprint ? (
                <Link
                  href={`/architect/blueprints/${selectedRow.blueprint.id}/editor`}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#16835f] px-4 text-xs font-extrabold !text-white shadow-sm transition hover:bg-[#116f50]"
                >
                  <PencilRuler className="h-4 w-4" />
                  Open Canvas Editor
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={openCreateForm}
                  disabled={!selectedRow || !canManageBlueprints}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#16835f] px-4 text-xs font-extrabold !text-white shadow-sm transition hover:bg-[#116f50] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Create Blueprint
                </button>
              )}
            </div>
          </div>
        </header>

        {successMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            {successMessage}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
            {error}
          </div>
        )}

        {selectedRow ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={Layers3}
                label="Canvas Objects"
                value={selectedRow.objectCount}
                detail={`${selectedRow.lotCount} mapped lot shapes`}
              />
              <StatCard
                icon={Building2}
                label="Linked Properties"
                value={selectedRow.linkedLotCount}
                detail={`${Math.max(0, selectedRow.lotCount - selectedRow.linkedLotCount)} shapes need linking`}
                accent="blue"
              />
              <StatCard
                icon={Eye}
                label="Available Lots"
                value={selectedRow.availableCount}
                detail={`${selectedRow.reservedCount} reserved`}
                accent="amber"
              />
              <StatCard
                icon={CheckCircle2}
                label="Sold Properties"
                value={selectedRow.soldCount}
                detail={`${selectedRow.availableCount + selectedRow.reservedCount + selectedRow.soldCount} tracked properties`}
                accent="violet"
              />
            </section>

            <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="overflow-hidden rounded-2xl border border-[#dce5e1] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_34px_rgba(15,23,42,0.045)]">
                <div className="flex flex-col gap-3 border-b border-[#e3e9e6] bg-white px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-extrabold tracking-tight text-[#17211d]">{selectedRow.village.name}</h2>
                      <span className={`rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider ${statusClasses(selectedRow.blueprint?.status)}`}>
                        {selectedRow.blueprint?.status || 'No blueprint'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-[#475b52]">
                      {selectedRow.village.city || 'Village site'}
                      {selectedRow.village.province ? `, ${selectedRow.village.province}` : ''}
                    </p>
                  </div>

                  <div className="flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[10px] font-extrabold text-emerald-700">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    </span>
                    Live sync
                    {lastSyncedAt && ` - ${lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  </div>
                </div>

                {selectedRow.blueprint && selectedRow.village.slug ? (
                  <div className="architect-preview-compact max-h-[440px] overflow-hidden bg-[#eef3f0] p-3">
                    <InteractiveVillageMap
                      key={`${selectedRow.village.id}-${previewVersion}`}
                      villageSlug={selectedRow.village.slug}
                      hideSidebar
                      allowDemoFallback={false}
                      adminPropertyMode
                      adminShowHidden
                      preferDraftBlueprint
                      showSmartAssistant={false}
                    />
                  </div>
                ) : (
                  <div className="canvas-grid-bg flex min-h-[420px] items-center justify-center bg-[#f6f9f7] p-5 text-center">
                    <div className="w-full max-w-md rounded-3xl border border-[#dce7e2] bg-white/95 p-8 shadow-[0_18px_55px_rgba(15,23,42,0.09)] backdrop-blur">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-[#16835f] shadow-sm">
                        <Map className="h-8 w-8" />
                      </div>
                      <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#16835f]">No active blueprint</p>
                      <h3 className="mt-2 text-xl font-extrabold tracking-tight text-[#223129]">Build the first site plan</h3>
                      <p className="mx-auto mt-3 max-w-sm text-sm font-medium leading-6 text-[#475b52]">
                        Create a blueprint draft, then add roads, lots, zones, and amenities in the canvas editor.
                      </p>
                      <button
                        type="button"
                        onClick={openCreateForm}
                        className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#16835f] px-6 text-xs font-extrabold !text-white shadow-[0_8px_18px_rgba(22,131,95,0.2)] transition hover:-translate-y-0.5 hover:bg-[#116f50]"
                      >
                        <Plus className="h-4 w-4" />
                        Create Blueprint Draft
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <aside className="space-y-5">
                <div className="rounded-2xl border border-[#dce5e1] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_rgba(15,23,42,0.04)]">
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#475b52]">Blueprint details</p>
                  <h3 className="mt-2 text-base font-extrabold text-[#17211d]">
                    {selectedRow.blueprint?.name || 'No blueprint yet'}
                  </h3>

                  <dl className="mt-5 space-y-3 text-xs">
                    <div className="flex items-center justify-between gap-4 border-b border-[#edf1ef] pb-3">
                      <dt className="font-semibold text-[#475b52]">Version</dt>
                      <dd className="font-extrabold text-[#223129]">
                        {selectedRow.blueprint ? `v${selectedRow.blueprint.version}` : '-'}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-b border-[#edf1ef] pb-3">
                      <dt className="font-semibold text-[#475b52]">Canvas size</dt>
                      <dd className="font-extrabold text-[#223129]">
                        {selectedRow.blueprint
                          ? `${selectedRow.blueprint.canvas_width} x ${selectedRow.blueprint.canvas_height}`
                          : '-'}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-b border-[#edf1ef] pb-3">
                      <dt className="font-semibold text-[#475b52]">Last updated</dt>
                      <dd className="font-extrabold text-[#223129]">
                        {formatDate(selectedRow.blueprint?.updated_at)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="font-semibold text-[#475b52]">Published</dt>
                      <dd className="font-extrabold text-[#223129]">
                        {formatDate(selectedRow.blueprint?.published_at)}
                      </dd>
                    </div>
                  </dl>

                  {selectedRow.blueprint && (
                    <div className="mt-5 space-y-2">
                      <Link
                        href={`/architect/blueprints/${selectedRow.blueprint.id}/editor`}
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#16835f] px-4 text-xs font-extrabold !text-white transition hover:bg-[#116f50]"
                      >
                        Continue Designing
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={deleteBlueprint}
                        disabled={deletingBlueprintId === selectedRow.blueprint.id}
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-xs font-extrabold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        {deletingBlueprintId === selectedRow.blueprint.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Delete Blueprint
                      </button>
                    </div>
                  )}
                </div>

                <div className="overflow-hidden rounded-2xl border border-[#203b31] bg-[#172b24] p-6 shadow-[0_12px_30px_rgba(15,23,42,0.12)]">
                  <div className="flex items-center gap-2 !text-[#7ee2bd]">
                    <Clock3 className="h-4 w-4" />
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.14em]">Preview behavior</p>
                  </div>
                  <p className="mt-3 text-sm font-bold leading-6 !text-white">
                    Draft saves are shown here before the map is published to buyers.
                  </p>
                  <p className="mt-2 text-xs leading-5 !text-[#b8c9c2]">
                    Pan and zoom the map to inspect road alignment, lot boundaries, labels, and environmental zones.
                  </p>
                </div>
              </aside>
            </section>

            <section className="rounded-2xl border border-[#dce5e1] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-[#17211d]">Assigned Villages</h2>
                  <p className="mt-1 text-sm font-medium text-[#475b52]">Switch preview scope or start an unconfigured village.</p>
                </div>
                {villagesWithoutBlueprints.length > 0 && (
                  <button
                    type="button"
                    onClick={openCreateForm}
                    className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl border border-[#cfe0d8] bg-emerald-50 px-4 text-xs font-extrabold text-[#13795b]"
                  >
                    <Plus className="h-4 w-4" />
                    New Blueprint
                  </button>
                )}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {rows.map((row) => (
                  <button
                    key={row.village.id}
                    type="button"
                    onClick={() => {
                      setSelectedVillageId(row.village.id);
                      setPreviewVersion((version) => version + 1);
                    }}
                    className={`flex items-center justify-between gap-4 rounded-xl border p-4 text-left transition ${
                      selectedRow.village.id === row.village.id
                        ? 'border-[#16835f] bg-emerald-50/60'
                        : 'border-[#e1e8e5] bg-[#fbfcfb] hover:border-[#bcd0c7]'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-[#223129]">{row.village.name}</p>
                      <p className="mt-1 text-xs font-semibold text-[#475b52]">
                        {row.blueprint ? `${row.lotCount} mapped lots` : 'Blueprint not started'}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[8px] font-extrabold uppercase ${statusClasses(row.blueprint?.status)}`}>
                      {row.blueprint?.status || 'New'}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </>
        ) : (
          <div className="flex min-h-[500px] items-center justify-center rounded-2xl border border-[#dce5e1] bg-white p-8 text-center shadow-sm">
            <div className="max-w-md">
              <MapPinned className="mx-auto h-10 w-10 text-[#5f7068]" />
              <h2 className="mt-4 text-lg font-extrabold text-[#223129]">No assigned villages</h2>
              <p className="mt-2 text-sm font-medium text-[#475b52]">
                Ask a super administrator to assign an active village to this architect account.
              </p>
            </div>
          </div>
        )}
      </div>

      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17211d]/45 p-4 backdrop-blur-sm">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              createBlueprintDraft(selectedVillageId, true);
            }}
            className="w-full max-w-md rounded-2xl border border-[#dce5e1] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#16835f]">New design</p>
                <h2 className="mt-1 text-xl font-extrabold text-[#17211d]">Create Blueprint Draft</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#52635b] transition hover:bg-[#f1f5f3] hover:text-[#223129]"
                aria-label="Close create blueprint dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="mt-5 block text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">
              Village
              <select
                value={selectedVillageId}
                onChange={(event) => setSelectedVillageId(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-[#d6e0db] bg-white px-3 text-sm font-bold normal-case tracking-normal text-[#223129] outline-none focus:border-[#16835f]"
              >
                {villagesWithoutBlueprints.map((row) => (
                  <option key={row.village.id} value={row.village.id}>
                    {row.village.name}
                  </option>
                ))}
              </select>
            </label>

            {villagesWithoutBlueprints.length === 0 && (
              <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs font-medium text-[#64748b]">
                Every assigned village already has an active blueprint.
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="min-h-11 rounded-xl border border-[#d6e0db] px-4 text-xs font-extrabold text-[#52635b]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || villagesWithoutBlueprints.length === 0}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#16835f] px-5 text-xs font-extrabold !text-white disabled:opacity-50"
              >
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                Create and Open Editor
              </button>
            </div>
          </form>
        </div>
      )}
    </DashboardShell>
  );
}
