'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import DashboardShell from '@/components/layout/DashboardShell';
import { getManageableVillages } from '@/lib/villages/getManageableVillages';
import { 
  Building, 
  Search, 
  SlidersHorizontal, 
  Loader2,
  Compass,
  Sun,
  ShieldAlert,
  Coins,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Pencil,
  Plus,
  Save,
  LayoutGrid,
  List,
  UploadCloud,
  X
} from 'lucide-react';
import Pagination from '@/components/shared/Pagination';
import { useRealtimeProperties } from '@/lib/realtime/useRealtimeVillage';
import { useRealtimeRefresh } from '@/lib/realtime/useRealtimeRefresh';

const PROPERTY_PAGE_SIZE = 8;

const EMPTY_PRESET = {
  name: '',
  property_type: 'house_and_lot',
  model_name: '',
  price: '',
  reservation_fee: '5000',
  interest_rate: '0',
  downpayment_percentage: '20',
  default_loan_term_years: '15',
  lot_size: '',
  floor_area: '',
  bedrooms: '0',
  bathrooms: '0',
  parking_slots: '0',
  flood_risk: 'low',
  sunlight_exposure: 'balanced',
  thumbnail_url: '',
  floor_plan_url: '',
  house_images: [],
  show_in_public_gallery: true,
  gallery_order: '0'
};

const acceptedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const presetInputClass = 'w-full rounded-lg border border-[#dbe4ee] bg-white px-3 py-2 text-sm text-[#272727] shadow-sm outline-none transition placeholder:text-[#94a3b8] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15';

function buildStorageFileName(fileName) {
  return fileName
    .replace(/[^a-z0-9._-]/gi, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function MiniField({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function VillageAdminPropertiesPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState([]);
  const [villages, setVillages] = useState([]);
  const [selectedVillageId, setSelectedVillageId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [presets, setPresets] = useState([]);
  const [showPresetForm, setShowPresetForm] = useState(false);
  const [presetForm, setPresetForm] = useState(EMPTY_PRESET);
  const [editingPresetId, setEditingPresetId] = useState('');
  const [savingPreset, setSavingPreset] = useState(false);
  const [uploadingPresetField, setUploadingPresetField] = useState('');
  const [presetViewMode, setPresetViewMode] = useState('grid');
  
  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [page, setPage] = useState(1);

  const fetchProperties = useCallback(async (
    villageId,
    { showLoading = true } = {}
  ) => {
    if (showLoading) setLoading(true);
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
      if (showLoading) setLoading(false);
    }
  }, [supabase]);

  const fetchPresets = useCallback(async (villageId) => {
    if (!villageId) return;
    const { data, error: presetError } = await supabase
      .from('property_type_presets')
      .select('*')
      .eq('village_id', villageId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (!presetError) {
      setPresets(data || []);
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
        await Promise.all([fetchProperties(vList[0].id), fetchPresets(vList[0].id)]);
      }
    } catch (err) {
      console.error('Error fetching properties setup data:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, fetchProperties, fetchPresets]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInitData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchInitData]);
  const refreshSelectedProperties = useCallback(() => {
    if (selectedVillageId) {
      fetchProperties(selectedVillageId, { showLoading: false });
    }
  }, [fetchProperties, selectedVillageId]);
  const schedulePropertiesRefresh = useRealtimeRefresh(refreshSelectedProperties, 250);
  useRealtimeProperties({
    villageId: selectedVillageId,
    onPropertyChange: schedulePropertiesRefresh
  });

  const handleVillageChange = (e) => {
    const vId = e.target.value;
    setSelectedVillageId(vId);
    setPage(1);
    setMessage('');
    setError('');
    fetchProperties(vId);
    fetchPresets(vId);
  };

  const updatePresetField = (field, value) => {
    setPresetForm((current) => ({ ...current, [field]: value }));
  };

  const handleNewPreset = () => {
    setPresetForm(EMPTY_PRESET);
    setEditingPresetId('');
    setShowPresetForm(true);
    setMessage('');
    setError('');
  };

  const handleEditPreset = (preset) => {
    setPresetForm({
      name: preset.name || '',
      property_type: preset.property_type || 'house_and_lot',
      model_name: preset.model_name || '',
      price: preset.price?.toString() || '',
      reservation_fee: preset.reservation_fee?.toString() || '5000',
      interest_rate: preset.interest_rate?.toString() || '0',
      downpayment_percentage: preset.downpayment_percentage?.toString() || '20',
      default_loan_term_years: preset.default_loan_term_years?.toString() || '15',
      lot_size: preset.lot_size?.toString() || '',
      floor_area: preset.floor_area?.toString() || '',
      bedrooms: preset.bedrooms?.toString() || '0',
      bathrooms: preset.bathrooms?.toString() || '0',
      parking_slots: preset.parking_slots?.toString() || '0',
      flood_risk: preset.flood_risk || 'low',
      sunlight_exposure: preset.sunlight_exposure || 'balanced',
      thumbnail_url: preset.thumbnail_url || '',
      floor_plan_url: preset.floor_plan_url || '',
      house_images: Array.isArray(preset.house_images) ? preset.house_images : [],
      show_in_public_gallery: preset.show_in_public_gallery !== false,
      gallery_order: preset.gallery_order?.toString() || '0'
    });
    setEditingPresetId(preset.id);
    setShowPresetForm(true);
    setMessage('');
    setError('');
  };

  const closePresetDrawer = () => {
    if (savingPreset || uploadingPresetField) return;
    setShowPresetForm(false);
    setPresetForm(EMPTY_PRESET);
    setEditingPresetId('');
    setError('');
  };

  const handlePresetMediaUpload = async (field, file) => {
    if (!file) return;

    if (!acceptedImageTypes.includes(file.type)) {
      setError('Please upload a JPG, PNG, or WebP image.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image upload limit is 10MB.');
      return;
    }

    setUploadingPresetField(field);
    setError('');

    try {
      const safeName = buildStorageFileName(file.name);
      const presetKey = editingPresetId || 'new-configuration';
      const uploadId = crypto.randomUUID();
      const storagePath = `property-presets/${selectedVillageId}/${presetKey}/${uploadId}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from('blueprint-assets')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('blueprint-assets')
        .getPublicUrl(storagePath);

      if (field === 'house_images') {
        setPresetForm((current) => ({
          ...current,
          house_images: [...current.house_images, data.publicUrl]
        }));
      } else {
        updatePresetField(field, data.publicUrl);
      }
    } catch (err) {
      setError(err.message || 'Image could not be uploaded.');
    } finally {
      setUploadingPresetField('');
    }
  };

  const handleSavePreset = async () => {
    if (!selectedVillageId || !presetForm.name || !presetForm.price || !presetForm.lot_size) {
      setError('Preset name, price, and lot size are required.');
      return;
    }

    setSavingPreset(true);
    setError('');
    setMessage('');

    const payload = {
      ...presetForm,
      village_id: selectedVillageId,
      price: Number(presetForm.price),
      reservation_fee: Number(presetForm.reservation_fee || 0),
      interest_rate: Number(presetForm.interest_rate || 0),
      downpayment_percentage: Number(presetForm.downpayment_percentage || 0),
      default_loan_term_years: Number.parseInt(presetForm.default_loan_term_years || 15, 10),
      lot_size: Number(presetForm.lot_size),
      floor_area: presetForm.floor_area === '' ? null : Number(presetForm.floor_area),
      bedrooms: Number.parseInt(presetForm.bedrooms || 0, 10),
      bathrooms: Number.parseInt(presetForm.bathrooms || 0, 10),
      parking_slots: Number.parseInt(presetForm.parking_slots || 0, 10),
      show_in_public_gallery: Boolean(presetForm.show_in_public_gallery),
      gallery_order: Number.parseInt(presetForm.gallery_order || 0, 10),
      orientation: null,
      updated_at: new Date().toISOString()
    };

    try {
      const { error: saveError } = editingPresetId
        ? await supabase
            .from('property_type_presets')
            .update(payload)
            .eq('id', editingPresetId)
            .eq('village_id', selectedVillageId)
        : await supabase
            .from('property_type_presets')
            .upsert(payload, { onConflict: 'village_id,name' });

      if (saveError) throw saveError;

      const modelKey = payload.model_name || payload.name;
      if (modelKey) {
        const configuredValues = {
          property_type: payload.property_type,
          model_name: payload.model_name || payload.name,
          price: payload.price,
          reservation_fee: payload.reservation_fee,
          interest_rate: payload.interest_rate,
          downpayment_percentage: payload.downpayment_percentage,
          default_loan_term_years: payload.default_loan_term_years,
          lot_size: payload.lot_size,
          floor_area: payload.floor_area,
          bedrooms: payload.bedrooms,
          bathrooms: payload.bathrooms,
          parking_slots: payload.parking_slots,
          flood_risk: payload.flood_risk,
          sunlight_exposure: payload.sunlight_exposure,
          thumbnail_url: payload.thumbnail_url || null,
          floor_plan_url: payload.floor_plan_url || null,
          updated_at: new Date().toISOString()
        };

        const { error: syncError } = await supabase
          .from('properties')
          .update(configuredValues)
          .eq('village_id', selectedVillageId)
          .eq('model_name', modelKey);

        if (syncError) {
          console.warn('Matching properties could not be synced from preset:', syncError.message);
        }

        const { error: specSyncError } = await supabase
          .from('properties')
          .update(configuredValues)
          .eq('village_id', selectedVillageId)
          .eq('property_type', payload.property_type)
          .eq('price', payload.price)
          .eq('reservation_fee', payload.reservation_fee)
          .eq('lot_size', payload.lot_size)
          .eq('floor_area', payload.floor_area)
          .eq('bedrooms', payload.bedrooms)
          .eq('bathrooms', payload.bathrooms)
          .eq('parking_slots', payload.parking_slots);

        if (specSyncError) {
          console.warn('Matching property specs could not be synced from preset:', specSyncError.message);
        }
      }

      setPresetForm(EMPTY_PRESET);
      setEditingPresetId('');
      setShowPresetForm(false);
      setMessage(editingPresetId ? 'Lot/house configuration updated.' : 'Lot/house configuration saved.');
      await fetchPresets(selectedVillageId);
    } catch (err) {
      setError(err.message || 'Preset could not be saved.');
    } finally {
      setSavingPreset(false);
    }
  };

  const handleDeletePreset = async (preset) => {
    if (!window.confirm(`Delete "${preset.name}" configuration?`)) return;

    const { error: deleteError } = await supabase
      .from('property_type_presets')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', preset.id)
      .eq('village_id', selectedVillageId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setPresets((current) => current.filter((item) => item.id !== preset.id));
    if (editingPresetId === preset.id) {
      setPresetForm(EMPTY_PRESET);
      setEditingPresetId('');
      setShowPresetForm(false);
    }
    setMessage('Lot/house configuration deleted.');
  };

  const handleDeleteProperty = async (property) => {
    if (!property?.id) return;

    const confirmed = window.confirm(
      `Delete ${property.property_code}?\n\nThis will remove the property record and unlink it from the blueprint. This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(property.id);
    setMessage('');
    setError('');

    try {
      const { data: activeReservations, error: reservationError } = await supabase
        .from('reservations')
        .select('id')
        .eq('property_id', property.id)
        .not('status', 'in', '(cancelled,rejected,expired)')
        .limit(1);

      if (reservationError) throw reservationError;
      if (activeReservations?.length > 0) {
        throw new Error('This property has an active reservation and cannot be deleted.');
      }

      const { error: unlinkError } = await supabase
        .from('blueprint_objects')
        .update({ linked_property_id: null, updated_at: new Date().toISOString() })
        .eq('linked_property_id', property.id);

      if (unlinkError) throw unlinkError;

      const { error: clearBlueprintError } = await supabase
        .from('properties')
        .update({ blueprint_object_id: null, updated_at: new Date().toISOString() })
        .eq('id', property.id)
        .eq('village_id', selectedVillageId);

      if (clearBlueprintError) throw clearBlueprintError;

      const { error: deleteError } = await supabase
        .from('properties')
        .delete()
        .eq('id', property.id)
        .eq('village_id', selectedVillageId);

      if (deleteError) throw deleteError;

      setProperties((current) => current.filter((item) => item.id !== property.id));
      setMessage(`${property.property_code} was deleted.`);
    } catch (err) {
      setError(err.message || 'Property could not be deleted.');
    } finally {
      setDeletingId('');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available':
        return 'border border-emerald-200 bg-emerald-50 text-emerald-800';
      case 'reserved':
        return 'border border-amber-200 bg-amber-50 text-amber-800';
      case 'sold':
        return 'border border-red-200 bg-red-50 text-red-800';
      case 'under_maintenance':
        return 'border border-[#cbd5e1] bg-[#f1f5f9] text-[#334155]';
      default:
        return 'border border-[#cbd5e1] bg-[#f1f5f9] text-[#334155]';
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
  const totalPropertyPages = Math.max(1, Math.ceil(filteredProperties.length / PROPERTY_PAGE_SIZE));
  const currentPropertyPage = Math.min(page, totalPropertyPages);
  const paginatedProperties = filteredProperties.slice(
    (currentPropertyPage - 1) * PROPERTY_PAGE_SIZE,
    currentPropertyPage * PROPERTY_PAGE_SIZE
  );

  if (loading && villages.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-slate-600">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        
        {/* Header Title */}
        <div className="flex flex-col justify-between gap-4 border-b border-[#e2e8f0] pb-4 md:flex-row md:items-center">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
              <Building className="h-6 w-6 text-emerald-600" />
              Properties Inventory
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Browse, search, and manage individual lot boundaries, pricing lists, and availability specifications.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="select-none text-xs font-bold uppercase tracking-wider text-slate-600">Scope:</span>
            <select
              value={selectedVillageId}
              onChange={handleVillageChange}
              disabled={villages.length === 0}
              className="cursor-pointer rounded-xl border border-[#dbe4ee] bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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
        {(message || error) && (
          <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
            error
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}>
            {error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            <span>{error || message}</span>
          </div>
        )}

        <div className="rounded-2xl border border-[#dbe4ee] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Lot / House Detail Configurations</h2>
              <p className="mt-1 text-sm text-slate-600">
                Create reusable property presets so new lots can auto-fill type, size, price, reservation fee, and interest rate.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 items-center rounded-xl border border-[#dbe4ee] bg-white p-1" role="group" aria-label="Configuration view">
                <button
                  type="button"
                  onClick={() => setPresetViewMode('grid')}
                  aria-label="Show configurations in grid view"
                  aria-pressed={presetViewMode === 'grid'}
                  title="Grid view"
                  className={`inline-flex h-7 w-8 items-center justify-center rounded-lg transition ${
                    presetViewMode === 'grid'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPresetViewMode('list')}
                  aria-label="Show configurations in list view"
                  aria-pressed={presetViewMode === 'list'}
                  title="List view"
                  className={`inline-flex h-7 w-8 items-center justify-center rounded-lg transition ${
                    presetViewMode === 'list'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                  }`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={handleNewPreset}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-extrabold text-white shadow transition hover:bg-emerald-500"
              >
                <Plus className="h-4 w-4" />
                Add Configuration
              </button>
            </div>
          </div>

          {presetViewMode === 'list' && presets.length > 0 ? (
            <div className="mt-5 overflow-x-auto rounded-xl border border-[#dbe4ee] bg-white">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                    <th className="px-3 py-2.5">Configuration</th>
                    <th className="px-3 py-2.5">Price & Reserve</th>
                    <th className="px-3 py-2.5">Financing</th>
                    <th className="px-3 py-2.5">Area</th>
                    <th className="px-3 py-2.5">Rooms</th>
                    <th className="px-3 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {presets.map((preset) => (
                    <tr key={preset.id} className="bg-white text-slate-700 transition-colors hover:bg-[#f8fafc]">
                      <td className="px-3 py-2.5">
                        <p className="font-extrabold text-slate-900">{preset.name}</p>
                        <p className="mt-0.5 text-[10px] font-bold uppercase text-emerald-700">
                          {preset.property_type?.replaceAll('_', ' ')}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 font-semibold">
                        <p>Price: PHP {Number(preset.price || 0).toLocaleString()}</p>
                        <p className="mt-0.5 text-slate-600">Reserve: PHP {Number(preset.reservation_fee || 0).toLocaleString()}</p>
                      </td>
                      <td className="px-3 py-2.5 font-semibold">
                        <p>{Number(preset.interest_rate || 0)}% interest</p>
                        <p className="mt-0.5 text-slate-600">
                          {Number(preset.downpayment_percentage || 0)}% down, {Number(preset.default_loan_term_years || 0)} yrs
                        </p>
                      </td>
                      <td className="px-3 py-2.5 font-semibold">
                        <p>Lot: {preset.lot_size || 0} sqm</p>
                        <p className="mt-0.5 text-slate-600">Floor: {preset.floor_area || 0} sqm</p>
                      </td>
                      <td className="px-3 py-2.5 font-semibold">
                        {preset.bedrooms || 0}BR / {preset.bathrooms || 0}BA
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEditPreset(preset)}
                            className="rounded-lg border border-emerald-200 p-1.5 text-emerald-700 transition hover:bg-emerald-50"
                            title="Edit configuration"
                            aria-label={`Edit ${preset.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePreset(preset)}
                            className="rounded-lg border border-rose-200 p-1.5 text-rose-700 transition hover:bg-rose-50"
                            title="Delete configuration"
                            aria-label={`Delete ${preset.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            {presets.length === 0 ? (
              <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 text-xs font-semibold text-slate-600">
                No configurations yet.
              </div>
            ) : presets.map((preset) => (
              <div key={preset.id} className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">{preset.name}</h3>
                    <p className="mt-1 text-[10px] font-bold uppercase text-emerald-700">{preset.property_type?.replaceAll('_', ' ')}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleEditPreset(preset)}
                      className="rounded-lg border border-emerald-200 p-1.5 text-emerald-700 transition hover:bg-emerald-50"
                      title="Edit configuration"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePreset(preset)}
                      className="rounded-lg border border-rose-200 p-1.5 text-rose-700 transition hover:bg-rose-50"
                      title="Delete configuration"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-700">
                  <span>Price: ₱{Number(preset.price || 0).toLocaleString()}</span>
                  <span>Reserve: ₱{Number(preset.reservation_fee || 0).toLocaleString()}</span>
                  <span>Interest: {Number(preset.interest_rate || 0)}%</span>
                  <span>Down: {Number(preset.downpayment_percentage || 0)}%</span>
                  <span>Term: {Number(preset.default_loan_term_years || 0)} yrs</span>
                  <span>Lot: {preset.lot_size || 0} sqm</span>
                  <span>Floor: {preset.floor_area || 0} sqm</span>
                  <span>{preset.bedrooms || 0}BR / {preset.bathrooms || 0}BA</span>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>

        {/* Filters Tool bar */}
        <div className="grid grid-cols-1 items-center gap-3 rounded-2xl border border-[#dbe4ee] bg-white p-3 shadow-sm md:grid-cols-[minmax(260px,2fr)_1fr_1fr_auto]">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by lot code or block/lot (e.g. B1L2)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-[#dbe4ee] bg-white py-2 pl-10 pr-4 text-sm text-slate-800 outline-none placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full cursor-pointer rounded-xl border border-[#dbe4ee] bg-white p-2 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full cursor-pointer rounded-xl border border-[#dbe4ee] bg-white p-2 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">All Lot Types</option>
              <option value="house_and_lot">House & Lot</option>
              <option value="lot">Lot Only</option>
              <option value="townhouse">Townhouse</option>
              <option value="duplex">Duplex</option>
              <option value="commercial_lot">Commercial</option>
            </select>
          </div>

          <div className="flex h-9 items-center rounded-xl border border-[#dbe4ee] bg-white p-1" role="group" aria-label="Property view">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="Show properties in grid view"
              aria-pressed={viewMode === 'grid'}
              title="Grid view"
              className={`inline-flex h-7 w-8 items-center justify-center rounded-lg transition ${
                viewMode === 'grid' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="Show properties in list view"
              aria-pressed={viewMode === 'list'}
              title="List view"
              className={`inline-flex h-7 w-8 items-center justify-center rounded-lg transition ${
                viewMode === 'list' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Properties inventory Table */}
        <div className="rounded-2xl border border-[#dbe4ee] bg-white p-4 shadow-sm">
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
          ) : viewMode === 'grid' ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {paginatedProperties.map((p) => (
                <article key={p.id} className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-slate-900">{p.property_code}</p>
                      <p className="mt-0.5 text-xs font-medium text-slate-600">
                        Block {p.block_number} Lot {p.lot_number}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ${getStatusColor(p.status)}`}>
                      {p.status?.replaceAll('_', ' ')}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div>
                      <p className="font-semibold text-slate-500">Model</p>
                      <p className="mt-0.5 font-bold text-slate-800">{p.model_name || 'Premium Lot Only'}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-500">Type</p>
                      <p className="mt-0.5 font-bold capitalize text-slate-800">{p.property_type?.replaceAll('_', ' ')}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-500">Area</p>
                      <p className="mt-0.5 font-bold text-slate-800">{p.lot_size} sqm</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-500">Price</p>
                      <p className="mt-0.5 font-bold text-slate-800">PHP {Number(p.price || 0).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3 text-[10px] font-semibold text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <ShieldAlert className={`h-3.5 w-3.5 ${p.flood_risk === 'high' ? 'text-red-500' : p.flood_risk === 'medium' ? 'text-amber-500' : 'text-emerald-600'}`} />
                      Flood: {p.flood_risk}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Sun className="h-3.5 w-3.5 text-amber-500" />
                      {p.sunlight_exposure}
                    </span>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleDeleteProperty(p)}
                      disabled={deletingId === p.id}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs font-semibold">
                <thead>
                  <tr className="select-none border-b border-[#e2e8f0] bg-[#f8fafc] text-[10px] uppercase tracking-wider text-slate-600">
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
                <tbody className="divide-y divide-[#e2e8f0] text-slate-700">
                  {paginatedProperties.map((p) => (
                    <tr key={p.id} className="bg-white transition-colors hover:bg-[#f8fafc]">
                      <td className="px-3 py-3 font-extrabold text-slate-900">{p.property_code}</td>
                      <td className="px-3 py-3 text-slate-700">Block {p.block_number} Lot {p.lot_number}</td>
                      <td className="py-3.5 px-3">
                        <span className="block text-slate-900">{p.model_name || 'Premium Lot Only'}</span>
                        <span className="text-[10px] capitalize text-slate-600">{p.property_type?.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {p.lot_size} sqm
                        {p.floor_area > 0 && <span className="block text-[10px] text-slate-600">Floor: {p.floor_area} sqm</span>}
                      </td>
                      <td className="px-3 py-3 font-bold text-slate-900">
                        ₱{p.price?.toLocaleString()}
                        <span className="text-[10px] text-emerald-400 block font-normal flex items-center gap-0.5">
                          <Coins className="w-3 h-3" /> Dep: ₱{p.reservation_fee?.toLocaleString()}
                        </span>
                        <span className="block text-[10px] font-normal text-slate-600">
                          Interest: {Number(p.interest_rate || 0)}%
                        </span>
                      </td>
                      <td className="py-3.5 px-3 space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700">
                          <ShieldAlert className={`w-3.5 h-3.5 ${p.flood_risk === 'high' ? 'text-red-400' : p.flood_risk === 'medium' ? 'text-amber-400' : 'text-emerald-400'}`} />
                          <span>Flood: <span className="capitalize">{p.flood_risk}</span></span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700">
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
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleDeleteProperty(p)}
                            disabled={deletingId === p.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 font-bold transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && filteredProperties.length > 0 && (
            <div className="mt-4">
              <Pagination
                currentPage={currentPropertyPage}
                totalItems={filteredProperties.length}
                pageSize={PROPERTY_PAGE_SIZE}
                onPageChange={setPage}
                itemLabel="properties"
              />
            </div>
          )}
        </div>

      </div>

      {showPresetForm && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-[1px]" role="presentation">
          <button
            type="button"
            aria-label="Close configuration drawer"
            className="absolute inset-0 cursor-default"
            onClick={closePresetDrawer}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="configuration-drawer-title"
            className="relative flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#e2e8f0] px-4 py-4 sm:px-5">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-700">
                  Property Inventory
                </p>
                <h2 id="configuration-drawer-title" className="mt-1 text-lg font-extrabold text-slate-900">
                  {editingPresetId ? 'Edit Lot / House Configuration' : 'New Lot / House Configuration'}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Configure reusable property details, thumbnail, and floor plan.
                </p>
              </div>
              <button
                type="button"
                onClick={closePresetDrawer}
                disabled={savingPreset || Boolean(uploadingPresetField)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#dbe4ee] bg-white text-[#64748b] transition hover:bg-[#f8fafc] disabled:opacity-50"
                aria-label="Close configuration drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-[#f8fafc] p-3 sm:p-4">
              {error && (
                <div className="mb-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-3">
                <section className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-extrabold text-[#272727]">Identity</h3>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <MiniField label="Configuration Name">
                      <input className={presetInputClass} placeholder="e.g. Verdant 50sqm" value={presetForm.name} onChange={(e) => updatePresetField('name', e.target.value)} />
                    </MiniField>
                    <MiniField label="Property Type">
                      <select className={presetInputClass} value={presetForm.property_type} onChange={(e) => updatePresetField('property_type', e.target.value)}>
                        <option value="lot">Lot</option>
                        <option value="house_and_lot">House and Lot</option>
                        <option value="townhouse">Townhouse</option>
                        <option value="duplex">Duplex</option>
                        <option value="commercial_lot">Commercial Lot</option>
                      </select>
                    </MiniField>
                    <MiniField label="Model Name">
                      <input className={presetInputClass} placeholder="e.g. Verdant" value={presetForm.model_name} onChange={(e) => updatePresetField('model_name', e.target.value)} />
                    </MiniField>
                    <MiniField label="Price">
                      <input type="number" min="0" className={presetInputClass} placeholder="3000000" value={presetForm.price} onChange={(e) => updatePresetField('price', e.target.value)} />
                    </MiniField>
                  </div>
                </section>

                <section className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-extrabold text-[#272727]">Pricing & Financing</h3>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <MiniField label="Reservation Fee">
                      <input type="number" min="0" className={presetInputClass} value={presetForm.reservation_fee} onChange={(e) => updatePresetField('reservation_fee', e.target.value)} />
                    </MiniField>
                    <MiniField label="Interest Rate (%)">
                      <input type="number" min="0" step="0.01" className={presetInputClass} value={presetForm.interest_rate} onChange={(e) => updatePresetField('interest_rate', e.target.value)} />
                    </MiniField>
                    <MiniField label="Downpayment (%)">
                      <input type="number" min="0" max="100" step="0.01" className={presetInputClass} value={presetForm.downpayment_percentage} onChange={(e) => updatePresetField('downpayment_percentage', e.target.value)} />
                    </MiniField>
                    <MiniField label="Default Loan Term (years)">
                      <input type="number" min="1" className={presetInputClass} value={presetForm.default_loan_term_years} onChange={(e) => updatePresetField('default_loan_term_years', e.target.value)} />
                    </MiniField>
                  </div>
                </section>

                <section className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-extrabold text-[#272727]">Property Specifications</h3>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <MiniField label="Lot Size (sqm)">
                      <input type="number" min="0" className={presetInputClass} value={presetForm.lot_size} onChange={(e) => updatePresetField('lot_size', e.target.value)} />
                    </MiniField>
                    <MiniField label="Floor Area (sqm)">
                      <input type="number" min="0" className={presetInputClass} value={presetForm.floor_area} onChange={(e) => updatePresetField('floor_area', e.target.value)} />
                    </MiniField>
                    <MiniField label="Bedrooms">
                      <input type="number" min="0" className={presetInputClass} value={presetForm.bedrooms} onChange={(e) => updatePresetField('bedrooms', e.target.value)} />
                    </MiniField>
                    <MiniField label="Bathrooms">
                      <input type="number" min="0" className={presetInputClass} value={presetForm.bathrooms} onChange={(e) => updatePresetField('bathrooms', e.target.value)} />
                    </MiniField>
                    <MiniField label="Parking Slots">
                      <input type="number" min="0" className={presetInputClass} value={presetForm.parking_slots} onChange={(e) => updatePresetField('parking_slots', e.target.value)} />
                    </MiniField>
                  </div>
                </section>

                <section className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-extrabold text-[#272727]">Property Media</h3>
                  <p className="mt-1 text-xs font-semibold text-[#64748b]">
                    These images are applied when this configuration is selected for a property.
                  </p>
                  <div className="mt-3 space-y-3">
                    {[
                      { field: 'thumbnail_url', label: 'Property Thumbnail', emptyText: 'Upload a property thumbnail' },
                      { field: 'floor_plan_url', label: 'Floor Plan', emptyText: 'Upload a floor plan image' }
                    ].map((media) => (
                      <div key={media.field} className="rounded-lg border border-[#dbe4ee] bg-white p-3">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">{media.label}</p>
                        {presetForm[media.field] && (
                          <a
                            href={presetForm[media.field]}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 block overflow-hidden rounded-lg border border-[#e2e8f0] bg-[#f8fafc]"
                          >
                            <div
                              role="img"
                              aria-label={`${media.label} preview`}
                              className="h-36 w-full bg-contain bg-center bg-no-repeat"
                              style={{ backgroundImage: `url("${presetForm[media.field]}")` }}
                            />
                          </a>
                        )}
                        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[#272727]">
                              {presetForm[media.field] ? `${media.label} uploaded` : media.emptyText}
                            </p>
                            <p className="mt-1 text-xs text-[#64748b]">JPG, PNG, or WebP up to 10MB.</p>
                          </div>
                          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-emerald-500">
                            {uploadingPresetField === media.field ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                            {uploadingPresetField === media.field ? 'Uploading...' : 'Upload Image'}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              disabled={Boolean(uploadingPresetField)}
                              onChange={(e) => handlePresetMediaUpload(media.field, e.target.files?.[0])}
                            />
                          </label>
                        </div>
                        {presetForm[media.field] && (
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                            <a href={presetForm[media.field]} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate rounded-lg border border-[#dbe4ee] bg-white px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50">
                              View uploaded {media.label.toLowerCase()}
                            </a>
                            <button type="button" onClick={() => updatePresetField(media.field, '')} className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50">
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="rounded-lg border border-[#dbe4ee] bg-white p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">House Model Images</p>
                          <p className="mt-1 text-sm font-bold text-[#272727]">
                            {presetForm.house_images.length
                              ? `${presetForm.house_images.length} carousel image${presetForm.house_images.length === 1 ? '' : 's'}`
                              : 'Upload images for this model'}
                          </p>
                          <p className="mt-1 text-xs text-[#64748b]">Upload multiple exterior or interior views.</p>
                        </div>
                        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-emerald-500">
                          {uploadingPresetField === 'house_images' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                          {uploadingPresetField === 'house_images' ? 'Uploading...' : 'Add Images'}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            className="hidden"
                            disabled={Boolean(uploadingPresetField)}
                            onChange={async (e) => {
                              const files = Array.from(e.target.files || []);
                              for (const file of files) {
                                await handlePresetMediaUpload('house_images', file);
                              }
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                      {presetForm.house_images.length > 0 && (
                        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {presetForm.house_images.map((imageUrl, index) => (
                            <div key={`${imageUrl}-${index}`} className="group relative overflow-hidden rounded-lg border border-[#e2e8f0] bg-[#f8fafc]">
                              <div
                                role="img"
                                aria-label={`House model image ${index + 1}`}
                                className="h-24 bg-cover bg-center"
                                style={{ backgroundImage: `url("${imageUrl}")` }}
                              />
                              <button
                                type="button"
                                onClick={() => setPresetForm((current) => ({
                                  ...current,
                                  house_images: current.house_images.filter((_, imageIndex) => imageIndex !== index)
                                }))}
                                className="absolute right-1.5 top-1.5 rounded-md bg-white/95 px-2 py-1 text-[10px] font-extrabold text-rose-600 shadow transition hover:bg-rose-50"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
                    <label className="flex items-center gap-3 rounded-lg border border-[#dbe4ee] bg-[#f8fafc] px-3 py-3">
                      <input
                        type="checkbox"
                        checked={presetForm.show_in_public_gallery}
                        onChange={(e) => updatePresetField('show_in_public_gallery', e.target.checked)}
                        className="h-4 w-4 accent-emerald-600"
                      />
                      <span>
                        <span className="block text-sm font-bold text-[#272727]">Show in public house carousel</span>
                        <span className="mt-0.5 block text-xs text-[#64748b]">Requires at least one house model image.</span>
                      </span>
                    </label>
                    <MiniField label="Display Order">
                      <input
                        type="number"
                        min="0"
                        className={presetInputClass}
                        value={presetForm.gallery_order}
                        onChange={(e) => updatePresetField('gallery_order', e.target.value)}
                      />
                    </MiniField>
                  </div>
                </section>
              </div>
            </div>

            <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-[#e2e8f0] bg-white/95 px-5 py-3 backdrop-blur sm:flex-row sm:justify-end">
              <button type="button" onClick={closePresetDrawer} disabled={savingPreset || Boolean(uploadingPresetField)} className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-bold text-[#272727] transition hover:bg-[#f8fafc] disabled:opacity-50">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePreset}
                disabled={savingPreset || Boolean(uploadingPresetField)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white transition hover:bg-emerald-500 disabled:opacity-60"
              >
                {savingPreset ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editingPresetId ? 'Update Configuration' : 'Save Configuration'}
              </button>
            </div>
          </aside>
        </div>
      )}
    </DashboardShell>
  );
}
