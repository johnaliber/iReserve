'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { ImagePlus, Loader2, Save, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { AMENITY_TYPES, getAmenityDefaults } from '@/lib/blueprints/amenities';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

function safeFileName(name) {
  return name.replace(/[^a-z0-9._-]/gi, '-').toLowerCase();
}

export default function AmenityEditorDrawer({
  open,
  villageId,
  blueprintObject,
  onClose,
  onSaved
}) {
  const supabase = useMemo(() => createClient(), []);
  const defaults = getAmenityDefaults(blueprintObject);
  const [form, setForm] = useState(defaults);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [error, setError] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');

  useEffect(() => {
    if (!open || !blueprintObject?.id) return undefined;

    let cancelled = false;

    fetch(`/api/admin/amenities/${blueprintObject.id}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Amenity details could not be loaded.');
        return payload.object;
      })
      .then((savedObject) => {
        if (!cancelled && savedObject) {
          setForm(getAmenityDefaults(savedObject));
        }
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message || 'Amenity details could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setLoadingDetails(false);
      });

    return () => {
      cancelled = true;
    };
  }, [blueprintObject, open]);

  if (!open || !blueprintObject) return null;

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const persistAmenityDetails = async (details) => {
    const response = await fetch(`/api/admin/amenities/${blueprintObject.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ villageId, details })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload.object) {
      throw new Error(payload.error || 'Amenity details could not be saved.');
    }

    return payload.object;
  };

  const uploadPhoto = async (file) => {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError('Please upload a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Amenity photos must be smaller than 10MB.');
      return;
    }

    setUploading(true);
    setError('');
    setUploadMessage('');
    try {
      const path = `amenities/${villageId}/${blueprintObject.id}/${Date.now()}-${safeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from('blueprint-assets')
        .upload(path, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('blueprint-assets').getPublicUrl(path);
      const publicUrl = data?.publicUrl;
      if (!publicUrl) throw new Error('Storage did not return a public image URL.');

      const savedObject = await persistAmenityDetails({ imageUrl: publicUrl });
      setForm(getAmenityDefaults(savedObject));
      setUploadMessage('Photo uploaded and saved.');
    } catch (uploadError) {
      setError(`Amenity photo could not be uploaded: ${uploadError.message || 'Unknown upload error.'}`);
    } finally {
      setUploading(false);
    }
  };

  const saveAmenity = async () => {
    setSaving(true);
    setError('');
    setUploadMessage('');
    try {
      await persistAmenityDetails({
        name: form.name.trim() || defaults.name,
        displayLabel: form.name.trim() || defaults.name,
        amenityType: form.amenityType,
        description: form.description.trim(),
        imageUrl: form.imageUrl || null,
        showLabel: form.showLabel,
        showTooltip: form.showTooltip,
        showInPublicMap: form.showInPublicMap
      });
      onSaved?.();
    } catch (saveError) {
      setError(saveError.message || 'Amenity details could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const removePhoto = async () => {
    setSaving(true);
    setError('');
    setUploadMessage('');
    try {
      const savedObject = await persistAmenityDetails({ imageUrl: null });
      setForm(getAmenityDefaults(savedObject));
      setUploadMessage('Photo removed.');
    } catch (removeError) {
      setError(removeError.message || 'Amenity photo could not be removed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-[#17211d]/25" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close amenity editor" className="flex-1" onClick={onClose} />
      <aside className="flex h-full w-full max-w-[480px] flex-col border-l border-[#dbe4ee] bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-[#e2e8f0] px-5 py-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-emerald-700">Amenity Management</p>
            <h2 className="mt-1 text-lg font-extrabold text-[#17211d]">Edit public amenity details</h2>
            <p className="mt-1 text-xs text-[#64748b]">These details and the photo appear to customers on the map.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-[#dbe4ee] p-2 text-[#475569] hover:bg-[#f8fafc]">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          {uploadMessage && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{uploadMessage}</p>}
          {loadingDetails && (
            <p className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading saved amenity details...
            </p>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-bold text-[#334155]">Amenity name</label>
            <input
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              className="h-10 w-full rounded-xl border border-[#cbd5e1] bg-white px-3 text-sm text-[#0f172a] outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-bold text-[#334155]">Amenity type</label>
            <select
              value={form.amenityType}
              onChange={(event) => updateField('amenityType', event.target.value)}
              className="h-10 w-full rounded-xl border border-[#cbd5e1] bg-white px-3 text-sm text-[#0f172a] outline-none focus:border-emerald-500"
            >
              {AMENITY_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-bold text-[#334155]">Customer description</label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
              placeholder="Describe what customers can expect from this amenity."
              className="w-full resize-none rounded-xl border border-[#cbd5e1] bg-white p-3 text-sm leading-6 text-[#0f172a] outline-none focus:border-emerald-500"
            />
          </div>

          <section className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#17211d]">Actual amenity photo</h3>
                <p className="mt-1 text-xs text-[#64748b]">JPG, PNG, or WebP up to 10MB.</p>
              </div>
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 text-xs font-bold text-emerald-800 hover:bg-emerald-50">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {uploading ? 'Uploading' : 'Upload photo'}
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  disabled={uploading}
                  onChange={(event) => {
                    uploadPhoto(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                  className="hidden"
                />
              </label>
            </div>
            {form.imageUrl ? (
              <div className="mt-4 overflow-hidden rounded-xl border border-[#dbe4ee] bg-white">
                <div className="relative h-48 w-full">
                  <Image src={form.imageUrl} alt={form.name || 'Amenity'} fill unoptimized className="object-cover" />
                </div>
                <button type="button" onClick={removePhoto} disabled={saving} className="w-full border-t border-[#e2e8f0] py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-60">
                  Remove photo
                </button>
              </div>
            ) : (
              <div className="mt-4 flex h-32 items-center justify-center rounded-xl border border-dashed border-[#cbd5e1] bg-white text-xs font-semibold text-[#64748b]">
                No amenity photo uploaded
              </div>
            )}
          </section>

          <section className="space-y-2 rounded-2xl border border-[#e2e8f0] p-4">
            <h3 className="mb-3 text-sm font-bold text-[#17211d]">Customer map visibility</h3>
            {[
              ['showLabel', 'Show amenity label'],
              ['showTooltip', 'Show details when hovered or tapped'],
              ['showInPublicMap', 'Show amenity on customer map']
            ].map(([field, label]) => (
              <label key={field} className="flex min-h-10 items-center justify-between gap-3 rounded-lg bg-[#f8fafc] px-3 text-sm font-semibold text-[#334155]">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={form[field]}
                  onChange={(event) => updateField(field, event.target.checked)}
                  className="h-4 w-4 accent-emerald-600"
                />
              </label>
            ))}
          </section>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[#e2e8f0] bg-white p-4">
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-[#cbd5e1] bg-white px-4 text-sm font-bold text-[#475569]">
            Cancel
          </button>
          <button
            type="button"
            onClick={saveAmenity}
            disabled={saving || uploading || loadingDetails}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-extrabold text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save amenity
          </button>
        </footer>
      </aside>
    </div>
  );
}
