'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Save, Trash2, Unlink, X } from 'lucide-react';

const EMPTY_FORM = {
  property_code: '',
  block_number: '',
  lot_number: '',
  street_name: '',
  property_type: 'lot',
  model_name: '',
  description: '',
  price: '',
  reservation_fee: '5000',
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
    property_code: property?.property_code || valueFromObjectData(objectData, ['property_code', 'propertyCode'], guessedCode),
    block_number: property?.block_number || blockNumber,
    lot_number: property?.lot_number || lotNumber,
    street_name: property?.street_name || valueFromObjectData(objectData, ['street_name', 'streetName'], ''),
    property_type: property?.property_type || (blueprintObject?.object_type === 'house' ? 'house_and_lot' : 'lot'),
    model_name: property?.model_name || '',
    description: property?.description || '',
    price: property?.price?.toString() || '',
    reservation_fee: property?.reservation_fee?.toString() || '5000',
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
const sectionClass = 'rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm';

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
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const isLinked = Boolean(property?.id);
  const title = isLinked ? 'Edit Property Details' : 'Create Property Details';
  const objectName = blueprintObject?.object_data?.name || blueprintObject?.object_type || 'Blueprint object';

  useEffect(() => {
    if (!open) return undefined;

    const timer = setTimeout(() => {
      setForm(buildForm(property, blueprintObject));
      setError('');
    }, 0);

    return () => clearTimeout(timer);
  }, [open, property, blueprintObject]);

  const canSubmit = useMemo(() => {
    return Boolean(
      form.property_code &&
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
  }, [form]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

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
            <h3 className="text-sm font-extrabold text-[#272727]">Basic</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Property Code" required>
                <input className={inputClass} value={form.property_code} onChange={(e) => updateField('property_code', e.target.value)} />
              </Field>
              <Field label="Property Type" required>
                <select className={inputClass} value={form.property_type} onChange={(e) => updateField('property_type', e.target.value)}>
                  <option value="lot">Lot</option>
                  <option value="house_and_lot">House and Lot</option>
                  <option value="townhouse">Townhouse</option>
                  <option value="duplex">Duplex</option>
                  <option value="commercial_lot">Commercial Lot</option>
                </select>
              </Field>
              <Field label="Block Number" required>
                <input className={inputClass} value={form.block_number} onChange={(e) => updateField('block_number', e.target.value)} />
              </Field>
              <Field label="Lot Number" required>
                <input className={inputClass} value={form.lot_number} onChange={(e) => updateField('lot_number', e.target.value)} />
              </Field>
              <Field label="Street Name">
                <input className={inputClass} value={form.street_name} onChange={(e) => updateField('street_name', e.target.value)} />
              </Field>
              <Field label="Model Name">
                <input className={inputClass} value={form.model_name} onChange={(e) => updateField('model_name', e.target.value)} />
              </Field>
            </div>
            <div className="mt-4">
            <Field label="Description">
              <textarea className={`${inputClass} min-h-24`} value={form.description} onChange={(e) => updateField('description', e.target.value)} />
            </Field>
            </div>
          </section>

          <section className={sectionClass}>
            <h3 className="text-sm font-extrabold text-[#272727]">Pricing</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Price" required>
                <input type="number" min="0" className={inputClass} value={form.price} onChange={(e) => updateField('price', e.target.value)} />
              </Field>
              <Field label="Reservation Fee" required>
                <input type="number" min="0" className={inputClass} value={form.reservation_fee} onChange={(e) => updateField('reservation_fee', e.target.value)} />
              </Field>
            </div>
          </section>

          <section className={sectionClass}>
            <h3 className="text-sm font-extrabold text-[#272727]">Lot Details</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Lot Size" required>
                <input type="number" min="0" className={inputClass} value={form.lot_size} onChange={(e) => updateField('lot_size', e.target.value)} />
              </Field>
              <Field label="Floor Area">
                <input type="number" min="0" className={inputClass} value={form.floor_area} onChange={(e) => updateField('floor_area', e.target.value)} />
              </Field>
              <Field label="Bedrooms">
                <input type="number" min="0" className={inputClass} value={form.bedrooms} onChange={(e) => updateField('bedrooms', e.target.value)} />
              </Field>
              <Field label="Bathrooms">
                <input type="number" min="0" className={inputClass} value={form.bathrooms} onChange={(e) => updateField('bathrooms', e.target.value)} />
              </Field>
              <Field label="Parking Slots">
                <input type="number" min="0" className={inputClass} value={form.parking_slots} onChange={(e) => updateField('parking_slots', e.target.value)} />
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
                <select className={inputClass} value={form.flood_risk} onChange={(e) => updateField('flood_risk', e.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </Field>
              <Field label="Sunlight Exposure" required>
                <select className={inputClass} value={form.sunlight_exposure} onChange={(e) => updateField('sunlight_exposure', e.target.value)}>
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
            <Field label="Thumbnail URL">
              <input className={inputClass} value={form.thumbnail_url} onChange={(e) => updateField('thumbnail_url', e.target.value)} />
            </Field>
            <Field label="Floor Plan URL">
              <input className={inputClass} value={form.floor_plan_url} onChange={(e) => updateField('floor_plan_url', e.target.value)} />
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
