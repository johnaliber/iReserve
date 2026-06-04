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
  Coins,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Pencil,
  Plus,
  Save
} from 'lucide-react';
import Link from 'next/link';

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
  sunlight_exposure: 'balanced'
};

function MiniField({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-slate-300">
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

  const handleVillageChange = (e) => {
    const vId = e.target.value;
    setSelectedVillageId(vId);
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
      sunlight_exposure: preset.sunlight_exposure || 'balanced'
    });
    setEditingPresetId(preset.id);
    setShowPresetForm(true);
    setMessage('');
    setError('');
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

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow glass-card">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-base font-extrabold text-white">Lot / House Detail Configurations</h2>
              <p className="mt-1 text-xs text-slate-400">
                Create reusable property presets so new lots can auto-fill type, size, price, reservation fee, and interest rate.
              </p>
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

          {showPresetForm && (
            <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-sm font-extrabold text-white">
                  {editingPresetId ? 'Edit Lot / House Configuration' : 'New Lot / House Configuration'}
                </h3>
                {editingPresetId && (
                  <button
                    type="button"
                    onClick={handleNewPreset}
                    className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-slate-900"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <MiniField label="Configuration Name">
                  <input className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-200 outline-none" placeholder="e.g. Verdant 50sqm" value={presetForm.name} onChange={(e) => updatePresetField('name', e.target.value)} />
                </MiniField>
                <MiniField label="Property Type">
                  <select className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-200 outline-none" value={presetForm.property_type} onChange={(e) => updatePresetField('property_type', e.target.value)}>
                    <option value="lot">Lot</option>
                    <option value="house_and_lot">House and Lot</option>
                    <option value="townhouse">Townhouse</option>
                    <option value="duplex">Duplex</option>
                    <option value="commercial_lot">Commercial Lot</option>
                  </select>
                </MiniField>
                <MiniField label="Model Name">
                  <input className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-200 outline-none" placeholder="e.g. Verdant" value={presetForm.model_name} onChange={(e) => updatePresetField('model_name', e.target.value)} />
                </MiniField>
                <MiniField label="Price">
                  <input type="number" min="0" className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-200 outline-none" placeholder="3000000" value={presetForm.price} onChange={(e) => updatePresetField('price', e.target.value)} />
                </MiniField>
                <MiniField label="Reservation Fee">
                  <input type="number" min="0" className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-200 outline-none" placeholder="5000" value={presetForm.reservation_fee} onChange={(e) => updatePresetField('reservation_fee', e.target.value)} />
                </MiniField>
                <MiniField label="Interest Rate (%)">
                  <input type="number" min="0" step="0.01" className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-200 outline-none" placeholder="0" value={presetForm.interest_rate} onChange={(e) => updatePresetField('interest_rate', e.target.value)} />
                </MiniField>
                <MiniField label="Downpayment (%)">
                  <input type="number" min="0" max="100" step="0.01" className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-200 outline-none" placeholder="20" value={presetForm.downpayment_percentage} onChange={(e) => updatePresetField('downpayment_percentage', e.target.value)} />
                </MiniField>
                <MiniField label="Default Loan Term (years)">
                  <input type="number" min="1" className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-200 outline-none" placeholder="15" value={presetForm.default_loan_term_years} onChange={(e) => updatePresetField('default_loan_term_years', e.target.value)} />
                </MiniField>
                <MiniField label="Lot Size (sqm)">
                  <input type="number" min="0" className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-200 outline-none" placeholder="50" value={presetForm.lot_size} onChange={(e) => updatePresetField('lot_size', e.target.value)} />
                </MiniField>
                <MiniField label="Floor Area (sqm)">
                  <input type="number" min="0" className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-200 outline-none" placeholder="50" value={presetForm.floor_area} onChange={(e) => updatePresetField('floor_area', e.target.value)} />
                </MiniField>
                <MiniField label="Bedrooms">
                  <input type="number" min="0" className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-200 outline-none" placeholder="1" value={presetForm.bedrooms} onChange={(e) => updatePresetField('bedrooms', e.target.value)} />
                </MiniField>
                <MiniField label="Bathrooms">
                  <input type="number" min="0" className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-200 outline-none" placeholder="1" value={presetForm.bathrooms} onChange={(e) => updatePresetField('bathrooms', e.target.value)} />
                </MiniField>
                <MiniField label="Parking Slots">
                  <input type="number" min="0" className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-200 outline-none" placeholder="1" value={presetForm.parking_slots} onChange={(e) => updatePresetField('parking_slots', e.target.value)} />
                </MiniField>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleSavePreset}
                  disabled={savingPreset}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                >
                  {savingPreset ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {editingPresetId ? 'Update Configuration' : 'Save Configuration'}
                </button>
              </div>
            </div>
          )}

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            {presets.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4 text-xs font-semibold text-slate-500">
                No configurations yet.
              </div>
            ) : presets.map((preset) => (
              <div key={preset.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-white">{preset.name}</h3>
                    <p className="mt-1 text-[10px] font-bold uppercase text-emerald-400">{preset.property_type?.replaceAll('_', ' ')}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleEditPreset(preset)}
                      className="rounded-lg border border-emerald-500/20 p-1.5 text-emerald-400 transition hover:bg-emerald-500/10"
                      title="Edit configuration"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePreset(preset)}
                      className="rounded-lg border border-rose-500/20 p-1.5 text-rose-400 transition hover:bg-rose-500/10"
                      title="Delete configuration"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-semibold text-slate-400">
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
                        <span className="text-[10px] text-slate-500 block font-normal">
                          Interest: {Number(p.interest_rate || 0)}%
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
                        <div className="flex justify-end gap-2">
                          <Link
                            href="/village-admin/dashboard"
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-950 border border-slate-850 hover:border-emerald-500/30 hover:bg-slate-800/30 text-emerald-400 font-bold rounded-lg transition"
                          >
                            Modify live
                            <ExternalLink className="w-3 h-3" />
                          </Link>
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
        </div>

      </div>
    </DashboardShell>
  );
}
