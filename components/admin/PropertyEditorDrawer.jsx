'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw, Save, Trash2, Unlink, UploadCloud, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { generatePropertyCode } from '@/lib/properties/numbering';

const EMPTY_FORM = {
  village_code: '',
  phase_number: '1',
  property_code: '',
  block_number: '',
  lot_number: '',
  street_name: '',
  property_type: 'lot',
  model_name: '',
  description: '',
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
  orientation: '',
  flood_risk: 'low',
  sunlight_exposure: 'balanced',
  status: 'available',
  thumbnail_url: '',
  floor_plan_url: '',
  notes: '',
  maintenance_reason: ''
};

function valueFromObjectData(objectData, keys, fallback = '') {
  for (const key of keys) {
    if (objectData?.[key] !== undefined && objectData?.[key] !== null && objectData?.[key] !== '') {
      return String(objectData[key]);
    }
  }
  return fallback;
}

function buildForm(property, blueprintObject) {
  const objectData = blueprintObject?.object_data || {};
  const blockNumber = valueFromObjectData(objectData, ['block_number', 'blockNumber', 'block'], '');
  const lotNumber = valueFromObjectData(objectData, ['lot_number', 'lotNumber', 'lot'], '');
  const guessedCode = blockNumber && lotNumber ? `B${blockNumber}-L${lotNumber}` : '';

  return {
    ...EMPTY_FORM,
    village_code: property?.village_code || '',
    phase_number: property?.phase_number || valueFromObjectData(objectData, ['phase_number', 'phaseNumber', 'phase'], '1'),
    property_code: property?.property_code || valueFromObjectData(objectData, ['property_code', 'propertyCode'], guessedCode),
    block_number: property?.block_number || blockNumber,
    lot_number: property?.lot_number || lotNumber,
    street_name: property?.street_name || valueFromObjectData(objectData, ['street_name', 'streetName'], ''),
    property_type: property?.property_type || (blueprintObject?.object_type === 'house' ? 'house_and_lot' : 'lot'),
    model_name: property?.model_name || '',
    description: property?.description || '',
    price: property?.price?.toString() || '',
    reservation_fee: property?.reservation_fee?.toString() || '5000',
    interest_rate: property?.interest_rate?.toString() || '0',
    downpayment_percentage: property?.downpayment_percentage?.toString() || '20',
    default_loan_term_years: property?.default_loan_term_years?.toString() || '15',
    lot_size: property?.lot_size?.toString() || valueFromObjectData(objectData, ['lot_size', 'lotSize', 'area'], ''),
    floor_area: property?.floor_area?.toString() || '',
    bedrooms: property?.bedrooms?.toString() || '0',
    bathrooms: property?.bathrooms?.toString() || '0',
    parking_slots: property?.parking_slots?.toString() || '0',
    orientation: property?.orientation || '',
    flood_risk: property?.flood_risk || 'low',
    sunlight_exposure: property?.sunlight_exposure || 'balanced',
    status: property?.status || 'available',
    thumbnail_url: property?.thumbnail_url || '',
    floor_plan_url: property?.floor_plan_url || '',
    notes: property?.notes || '',
    maintenance_reason: property?.maintenance_reason || ''
  };
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
        {label}{required ? ' *' : ''}
      </span>
      {children}
    </label>
  );
}

const inputClass = 'w-full rounded-lg border border-[#dbe4ee] bg-white px-3 py-2.5 text-sm text-[#272727] shadow-sm outline-none transition placeholder:text-[#94a3b8] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15';
const lockedInputClass = `${inputClass} cursor-not-allowed bg-[#f8fafc] text-[#64748b]`;
const sectionClass = 'rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm';
const acceptedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];

function buildStorageFileName(fileName) {
  return fileName
    .replace(/[^a-z0-9._-]/gi, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

export default function PropertyEditorDrawer({
  open,
  villageId,
  blueprintObject,
  property,
  isSuperAdmin = false,
  onClose,
  onSaved,
  onDeleted
}) {
  const supabase = createClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [checkingLot, setCheckingLot] = useState(false);
  const [lotHelper, setLotHelper] = useState('');
  const [error, setError] = useState('');
  const [presets, setPresets] = useState([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [uploadingField, setUploadingField] = useState('');

  const isLinked = Boolean(property?.id);
  const title = isLinked ? 'Edit Property Details' : 'Create Property Details';
  const objectName = blueprintObject?.object_data?.name || blueprintObject?.object_type || 'Blueprint object';

  useEffect(() => {
    if (!open) return undefined;

    const timer = setTimeout(() => {
      setForm(buildForm(property, blueprintObject));
      setError('');
      setLotHelper('');
      setSelectedPresetId('');
    }, 0);

    return () => clearTimeout(timer);
  }, [open, property, blueprintObject]);

  useEffect(() => {
    if (!open || !villageId) return undefined;

    const timer = setTimeout(async () => {
      const { data, error: presetsError } = await supabase
        .from('property_type_presets')
        .select('*')
        .eq('village_id', villageId)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (!presetsError) {
        setPresets(data || []);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [open, villageId, supabase]);

  const canSubmit = useMemo(() => {
    return Boolean(
      form.property_code &&
      (isLinked || selectedPresetId) &&
      form.phase_number &&
      form.block_number &&
      form.lot_number &&
      form.property_type &&
      form.price &&
      form.reservation_fee &&
      form.lot_size &&
      form.status &&
      form.flood_risk &&
      form.sunlight_exposure &&
      (form.status !== 'under_maintenance' || form.maintenance_reason)
    );
  }, [form, isLinked, selectedPresetId]);

  const updateField = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (['village_code', 'phase_number', 'block_number', 'lot_number'].includes(field)) {
        next.property_code = generatePropertyCode({
          villageCode: next.village_code,
          phaseNumber: next.phase_number,
          blockNumber: next.block_number,
          lotNumber: next.lot_number
        });
      }
      return next;
    });
  };

  const handleMediaUpload = async (field, file) => {
    if (!file) return;

    if (!acceptedImageTypes.includes(file.type)) {
      setError('Please upload a JPG, PNG, or WebP image.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image upload limit is 10MB.');
      return;
    }

    setUploadingField(field);
    setError('');

    try {
      const ownerId = property?.id || blueprintObject?.id || 'new-property';
      const safeName = buildStorageFileName(file.name);
      const storagePath = `properties/${villageId || 'unassigned'}/${ownerId}/${Date.now()}-${safeName}`;

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

      updateField(field, data.publicUrl);
    } catch (err) {
      setError(err.message || 'Image could not be uploaded.');
    } finally {
      setUploadingField('');
    }
  };

  const applyPreset = (presetId) => {
    setSelectedPresetId(presetId);
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) return;

    setForm((current) => ({
      ...current,
      property_type: preset.property_type || current.property_type,
      model_name: preset.model_name || preset.name || current.model_name,
      description: preset.description || current.description,
      price: preset.price?.toString() || current.price,
      reservation_fee: preset.reservation_fee?.toString() || current.reservation_fee,
      interest_rate: preset.interest_rate?.toString() || current.interest_rate || '0',
      downpayment_percentage: preset.downpayment_percentage?.toString() || current.downpayment_percentage || '20',
      default_loan_term_years: preset.default_loan_term_years?.toString() || current.default_loan_term_years || '15',
      lot_size: preset.lot_size?.toString() || current.lot_size,
      floor_area: preset.floor_area?.toString() || '',
      bedrooms: preset.bedrooms?.toString() || '0',
      bathrooms: preset.bathrooms?.toString() || '0',
      parking_slots: preset.parking_slots?.toString() || '0',
      flood_risk: preset.flood_risk || current.flood_risk,
      sunlight_exposure: preset.sunlight_exposure || current.sunlight_exposure
    }));
  };

  const refreshLotNumber = useCallback(async ({ force = true } = {}) => {
    if (!villageId || !form.phase_number || !form.block_number) return;
    if (!force && isLinked) return;

    setCheckingLot(true);
    setLotHelper('Checking next available lot number...');
    try {
      const params = new URLSearchParams({
        villageId,
        phaseNumber: form.phase_number,
        blockNumber: form.block_number
      });
      if (property?.id) params.set('propertyId', property.id);

      const res = await fetch(`/api/admin/properties/from-blueprint?${params.toString()}`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Lot number could not be checked.');

      setForm((current) => ({
        ...current,
        village_code: payload.villageCode || current.village_code,
        phase_number: payload.phaseNumber || current.phase_number,
        block_number: payload.blockNumber || current.block_number,
        lot_number: payload.lotNumber || current.lot_number,
        property_code: payload.propertyCode || current.property_code
      }));
      setLotHelper(`Next available lot number: L${payload.lotNumber}`);
    } catch (err) {
      setLotHelper('');
      setError(err.message || 'Lot number could not be checked.');
    } finally {
      setCheckingLot(false);
    }
  }, [form.block_number, form.phase_number, isLinked, property, villageId]);

  useEffect(() => {
    if (!open || !form.block_number || !form.phase_number) return undefined;
    const timer = setTimeout(() => {
      const phaseChanged = String(form.phase_number || '') !== String(property?.phase_number || '1');
      const blockChanged = String(form.block_number || '') !== String(property?.block_number || '');
      refreshLotNumber({ force: !isLinked || phaseChanged || blockChanged });
    }, 350);
    return () => clearTimeout(timer);
  }, [open, form.phase_number, form.block_number, isLinked, property, refreshLotNumber]);

  const saveProperty = async () => {
    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/admin/properties/from-blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          villageId,
          blueprintObjectId: blueprintObject?.id,
          propertyId: property?.id || null,
          formData: form
        })
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Property could not be saved.');
      }

      onSaved?.(payload.property);
    } catch (err) {
      setError(err.message || 'Property could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const removeLinkOrProperty = async (mode) => {
    if (!property?.id) return;
    const actionText = mode === 'delete' ? 'delete this property' : 'unlink this property from the blueprint object';
    if (!window.confirm(`Are you sure you want to ${actionText}?`)) return;

    setDeleting(true);
    setError('');

    try {
      const res = await fetch('/api/admin/properties/from-blueprint', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          villageId,
          blueprintObjectId: blueprintObject?.id,
          propertyId: property.id,
          mode
        })
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Property could not be removed.');
      }

      onDeleted?.();
    } catch (err) {
      setError(err.message || 'Property could not be removed.');
    } finally {
      setDeleting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#272727]/35 backdrop-blur-[2px]">
      <button className="flex-1 cursor-default" aria-label="Close property editor" onClick={onClose} />
      <aside className="h-full w-full max-w-2xl overflow-y-auto border-l border-[#e2e8f0] bg-[#f8fafc] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#e2e8f0] bg-white/95 px-6 py-5 backdrop-blur">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">{objectName}</p>
            <h2 className="text-xl font-extrabold text-[#272727]">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#e2e8f0] bg-white p-2 text-[#272727] transition hover:border-[#cbd5e1] hover:bg-[#f8fafc]"
            aria-label="Close drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          {error && (
            <div className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <section className={sectionClass}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-[#272727]">Auto Numbering</h3>
                <p className="mt-1 text-xs text-[#64748b]">
                  Lot number is automatically counted based on the selected phase and block.
                </p>
              </div>
              <button
                type="button"
                onClick={() => refreshLotNumber({ force: true })}
                disabled={checkingLot || !form.phase_number || !form.block_number}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#dbe4ee] bg-white px-3 py-2 text-xs font-bold text-[#272727] transition hover:bg-[#f8fafc] disabled:opacity-60"
              >
                {checkingLot ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Refresh Lot
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Village Code" required>
                <input className={`${inputClass} bg-[#f8fafc] font-bold uppercase`} value={form.village_code} readOnly />
              </Field>
              <Field label="Phase Number" required>
                <input type="number" min="1" className={inputClass} value={form.phase_number} onChange={(e) => updateField('phase_number', e.target.value)} />
              </Field>
              <Field label="Block Number" required>
                <input type="number" min="1" className={inputClass} value={form.block_number} onChange={(e) => updateField('block_number', e.target.value)} />
              </Field>
              <Field label="Lot Number" required>
                <input
                  type="number"
                  min="1"
                  className={`${inputClass} ${isSuperAdmin ? '' : 'bg-[#f8fafc]'}`}
                  value={form.lot_number}
                  readOnly={!isSuperAdmin}
                  onChange={(e) => updateField('lot_number', e.target.value)}
                />
              </Field>
              <Field label="Property Code" required>
                <input
                  className={`${inputClass} bg-[#f8fafc] font-extrabold uppercase`}
                  value={form.property_code}
                  readOnly={!isSuperAdmin}
                  onChange={(e) => updateField('property_code', e.target.value)}
                />
              </Field>
            </div>
            {lotHelper && (
              <p className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                {lotHelper}
              </p>
            )}
          </section>

          <section className={sectionClass}>
            <h3 className="text-sm font-extrabold text-[#272727]">Basic</h3>
            <p className="mt-1 text-xs font-semibold text-[#64748b]">
              Configured model fields are managed from Lot / House Detail Configurations.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Configured Lot / House Type" required={!isLinked}>
                <select className={inputClass} value={selectedPresetId} onChange={(e) => applyPreset(e.target.value)}>
                  <option value="">Choose a saved configuration</option>
                  {presets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name} - {preset.property_type?.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Property Type" required>
                <select className={lockedInputClass} value={form.property_type} disabled>
                  <option value="lot">Lot</option>
                  <option value="house_and_lot">House and Lot</option>
                  <option value="townhouse">Townhouse</option>
                  <option value="duplex">Duplex</option>
                  <option value="commercial_lot">Commercial Lot</option>
                </select>
              </Field>
              <Field label="Street Name">
                <input className={inputClass} value={form.street_name} onChange={(e) => updateField('street_name', e.target.value)} />
              </Field>
              <Field label="Model Name">
                <input className={lockedInputClass} value={form.model_name} readOnly />
              </Field>
            </div>
            <div className="mt-4">
            <Field label="Description">
              <textarea className={`${lockedInputClass} min-h-24`} value={form.description} readOnly />
            </Field>
            </div>
          </section>

          <section className={sectionClass}>
            <h3 className="text-sm font-extrabold text-[#272727]">Pricing</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Price" required>
                <input type="number" min="0" className={lockedInputClass} value={form.price} readOnly />
              </Field>
              <Field label="Reservation Fee" required>
                <input type="number" min="0" className={lockedInputClass} value={form.reservation_fee} readOnly />
              </Field>
              <Field label="Interest Rate (%)">
                <input type="number" min="0" step="0.01" className={lockedInputClass} value={form.interest_rate} readOnly />
              </Field>
              <Field label="Downpayment (%)">
                <input type="number" min="0" max="100" step="0.01" className={lockedInputClass} value={form.downpayment_percentage} readOnly />
              </Field>
              <Field label="Default Loan Term (years)">
                <input type="number" min="1" className={lockedInputClass} value={form.default_loan_term_years} readOnly />
              </Field>
            </div>
          </section>

          <section className={sectionClass}>
            <h3 className="text-sm font-extrabold text-[#272727]">Lot Details</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Lot Size" required>
                <input type="number" min="0" className={lockedInputClass} value={form.lot_size} readOnly />
              </Field>
              <Field label="Floor Area">
                <input type="number" min="0" className={lockedInputClass} value={form.floor_area} readOnly />
              </Field>
              <Field label="Bedrooms">
                <input type="number" min="0" className={lockedInputClass} value={form.bedrooms} readOnly />
              </Field>
              <Field label="Bathrooms">
                <input type="number" min="0" className={lockedInputClass} value={form.bathrooms} readOnly />
              </Field>
              <Field label="Parking Slots">
                <input type="number" min="0" className={lockedInputClass} value={form.parking_slots} readOnly />
              </Field>
              <Field label="Orientation">
                <input className={inputClass} value={form.orientation} onChange={(e) => updateField('orientation', e.target.value)} />
              </Field>
            </div>
          </section>

          <section className={sectionClass}>
            <h3 className="text-sm font-extrabold text-[#272727]">Risk & Environment</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Status" required>
                <select className={inputClass} value={form.status} onChange={(e) => updateField('status', e.target.value)}>
                  <option value="available">Available</option>
                  <option value="reserved">Reserved</option>
                  <option value="sold">Sold</option>
                  <option value="under_maintenance">Under Maintenance</option>
                  <option value="hidden">Hidden</option>
                </select>
              </Field>
              <Field label="Flood Risk" required>
                <select className={lockedInputClass} value={form.flood_risk} disabled>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </Field>
              <Field label="Sunlight Exposure" required>
                <select className={lockedInputClass} value={form.sunlight_exposure} disabled>
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="balanced">Balanced</option>
                  <option value="limited">Limited</option>
                </select>
              </Field>
              {form.status === 'under_maintenance' && (
                <Field label="Maintenance Reason" required>
                  <input className={inputClass} value={form.maintenance_reason} onChange={(e) => updateField('maintenance_reason', e.target.value)} />
                </Field>
              )}
            </div>
          </section>

          <section className={sectionClass}>
            <h3 className="text-sm font-extrabold text-[#272727]">Images & Media</h3>
            <div className="mt-4 space-y-4">
              <Field label="Thumbnail Image">
                <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-[#272727]">
                        {form.thumbnail_url ? 'Thumbnail image uploaded' : 'Upload a property thumbnail'}
                      </p>
                      <p className="mt-1 text-xs text-[#64748b]">Accepted: JPG, PNG, or WebP up to 10MB.</p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white shadow transition hover:bg-emerald-500">
                      {uploadingField === 'thumbnail_url' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                      {uploadingField === 'thumbnail_url' ? 'Uploading...' : 'Upload Image'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={uploadingField === 'thumbnail_url'}
                        onChange={(e) => handleMediaUpload('thumbnail_url', e.target.files?.[0])}
                      />
                    </label>
                  </div>
                  {form.thumbnail_url && (
                    <a
                      href={form.thumbnail_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 block truncate rounded-lg border border-[#dbe4ee] bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:text-emerald-600"
                    >
                      View uploaded thumbnail
                    </a>
                  )}
                </div>
              </Field>
              <Field label="Floor Plan Image">
                <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-[#272727]">
                        {form.floor_plan_url ? 'Floor plan image uploaded' : 'Upload a floor plan image'}
                      </p>
                      <p className="mt-1 text-xs text-[#64748b]">Accepted: JPG, PNG, or WebP up to 10MB.</p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white shadow transition hover:bg-emerald-500">
                      {uploadingField === 'floor_plan_url' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                      {uploadingField === 'floor_plan_url' ? 'Uploading...' : 'Upload Image'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={uploadingField === 'floor_plan_url'}
                        onChange={(e) => handleMediaUpload('floor_plan_url', e.target.files?.[0])}
                      />
                    </label>
                  </div>
                  {form.floor_plan_url && (
                    <a
                      href={form.floor_plan_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 block truncate rounded-lg border border-[#dbe4ee] bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:text-emerald-600"
                    >
                      View uploaded floor plan
                    </a>
                  )}
                </div>
              </Field>
            </div>
          </section>

          <section className={sectionClass}>
            <h3 className="text-sm font-extrabold text-[#272727]">Admin Notes</h3>
            <div className="mt-4">
            <Field label="Notes">
              <textarea className={`${inputClass} min-h-28`} value={form.notes} onChange={(e) => updateField('notes', e.target.value)} />
            </Field>
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-[#e2e8f0] bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex gap-2">
            {isSuperAdmin && isLinked && (
              <>
                <button
                  type="button"
                  onClick={() => removeLinkOrProperty('unlink')}
                  disabled={deleting || saving}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm font-bold text-[#272727] transition hover:bg-[#f8fafc] disabled:opacity-60"
                >
                  <Unlink className="h-4 w-4" />
                  Unlink
                </button>
                <button
                  type="button"
                  onClick={() => removeLinkOrProperty('delete')}
                  disabled={deleting || saving}
                  className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={saveProperty}
            disabled={!canSubmit || saving || deleting}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white shadow transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Property
          </button>
        </div>
      </aside>
    </div>
  );
}
