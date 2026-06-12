'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Trash2, Link as LinkIcon, Shield, Unlock, Lock, HelpCircle } from 'lucide-react';
import {
  AMENITY_SHAPES,
  AMENITY_TYPES,
  getAmenityDefaults,
  isAmenityObject
} from '@/lib/blueprints/amenities';

export default function PropertiesPanel({
  selectedObject,
  onUpdateObject,
  onDeleteObject,
  villageId
}) {
  const supabase = createClient();
  const [properties, setProperties] = useState([]);
  const [loadingProps, setLoadingProps] = useState(false);

  const fetchAvailableProperties = useCallback(async () => {
    setLoadingProps(true);
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('id, blueprint_object_id, property_code, block_number, lot_number, status, price, lot_size')
        .eq('village_id', villageId);

      if (!error && data) {
        setProperties(
          data.filter((property) => (
            !property.blueprint_object_id ||
            property.blueprint_object_id === selectedObject.id ||
            property.id === selectedObject.linked_property_id
          ))
        );
      }
    } catch (err) {
      console.error('Error fetching unlinked properties:', err);
    } finally {
      setLoadingProps(false);
    }
  }, [selectedObject, villageId, supabase]);

  useEffect(() => {
    if (selectedObject && (selectedObject.object_type === 'lot' || selectedObject.object_type === 'house') && villageId) {
      const timer = setTimeout(() => fetchAvailableProperties(), 0);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [selectedObject, villageId, fetchAvailableProperties]);

  if (!selectedObject) {
    return (
      <aside className="editor-properties-panel flex min-h-52 w-full select-none flex-col items-center justify-center bg-white p-5 text-center text-slate-600">
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <HelpCircle className="h-5 w-5" />
        </span>
        <h4 className="text-sm font-bold text-slate-900">No object selected</h4>
        <p className="mt-1 max-w-[220px] text-xs leading-relaxed text-slate-600">
          Click any element on the blueprint workspace to inspect and edit its properties.
        </p>
      </aside>
    );
  }

  const { object_type, object_data = {}, is_locked = false } = selectedObject;
  const isImageLayer = object_type === 'image_layer' || (object_type === 'landmark' && object_data.kind === 'reference_image');
  const isAmenity = isAmenityObject(selectedObject) && !isImageLayer;
  const amenityDefaults = isAmenity ? getAmenityDefaults(selectedObject) : null;

  const handleDataChange = (key, value) => {
    onUpdateObject({
      ...selectedObject,
      object_data: {
        ...object_data,
        [key]: value
      }
    });
  };

  const handleLockToggle = () => {
    onUpdateObject({
      ...selectedObject,
      is_locked: !is_locked
    });
  };

  const handleLinkProperty = (propertyId) => {
    const linkedProperty = properties.find((property) => property.id === propertyId);
    onUpdateObject({
      ...selectedObject,
      linked_property_id: propertyId || null,
      object_data: linkedProperty ? {
        ...object_data,
        block_number: linkedProperty.block_number,
        lot_number: linkedProperty.lot_number,
        property_code: linkedProperty.property_code
      } : object_data
    });
  };

  const handleLotFieldChange = (key, value) => {
    const nextData = {
      ...object_data,
      [key]: value
    };

    const matchedProperty = properties.find((property) => (
      String(property.block_number || '').trim().toLowerCase() === String(nextData.block_number || '').trim().toLowerCase() &&
      String(property.lot_number || '').trim().toLowerCase() === String(nextData.lot_number || '').trim().toLowerCase()
    ));

    onUpdateObject({
      ...selectedObject,
      linked_property_id: matchedProperty?.id || selectedObject.linked_property_id || null,
      object_data: matchedProperty ? {
        ...nextData,
        property_code: matchedProperty.property_code
      } : nextData
    });
  };

  return (
    <aside className="editor-properties-panel flex w-full select-none flex-col gap-3 bg-white p-4 pt-12">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <span className="block text-sm font-bold text-slate-900">Object properties</span>
          <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wider text-emerald-700">{object_type.replaceAll('_', ' ')}</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={handleLockToggle}
            title={is_locked ? 'Unlock Object' : 'Lock Position'}
            className={`p-1.5 rounded-lg border transition outline-none cursor-pointer ${
              is_locked 
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {is_locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onDeleteObject(selectedObject.id)}
            title="Delete Element"
            className="cursor-pointer rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-700 outline-none transition hover:bg-red-100"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/30 p-3">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Object Inspector</span>

        {(object_data.x !== undefined || isImageLayer) && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1">X</label>
              <input
                type="number"
                value={Math.round(object_data.x || 0)}
                onChange={(e) => handleDataChange('x', parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none"
              />
            </div>
            <div>
              <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Y</label>
              <input
                type="number"
                value={Math.round(object_data.y || 0)}
                onChange={(e) => handleDataChange('y', parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none"
              />
            </div>
          </div>
        )}

        {(object_data.width !== undefined || isImageLayer) && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Width</label>
              <input
                type="number"
                value={Math.round(object_data.width || 0)}
                onChange={(e) => handleDataChange('width', Math.max(1, parseFloat(e.target.value) || 1))}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none"
              />
            </div>
            <div>
              <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Height</label>
              <input
                type="number"
                value={Math.round(object_data.height || 0)}
                onChange={(e) => handleDataChange('height', Math.max(1, parseFloat(e.target.value) || 1))}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Rotation</label>
            <input
              type="number"
              value={Math.round(object_data.rotation || 0)}
              onChange={(e) => handleDataChange('rotation', parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none"
            />
          </div>
          <div>
            <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Layer</label>
            <input
              type="number"
              value={selectedObject.layer_order || 0}
              onChange={(e) => onUpdateObject({ ...selectedObject, layer_order: parseInt(e.target.value) || 0 })}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Opacity</label>
          <input
            type="range"
            min="0.05"
            max="1"
            step="0.05"
            value={object_data.opacity ?? 1}
            onChange={(e) => handleDataChange('opacity', parseFloat(e.target.value))}
            className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>

      {isImageLayer && (
        <div className="space-y-3 rounded-xl border border-sky-500/10 bg-sky-500/5 p-3">
          <h5 className="text-[10px] font-bold text-sky-300 uppercase tracking-wider">Image Layer</h5>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Layer Name
            </label>
            <input
              type="text"
              value={object_data.name || ''}
              onChange={(e) => handleDataChange('name', e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-800 focus:border-sky-500/50 rounded-lg p-2 text-xs text-slate-200 outline-none"
            />
          </div>
          <div className="space-y-2">
            {[
              ['showInEditor', 'Show in editor'],
              ['showInAdminPreview', 'Show in admin preview'],
              ['showInPublicMap', 'Show in public map']
            ].map(([key, label]) => (
              <label key={key} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-[11px] font-semibold text-slate-300">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={object_data[key] !== false}
                  onChange={(e) => handleDataChange(key, e.target.checked)}
                  className="h-4 w-4 accent-emerald-500"
                />
              </label>
            ))}
          </div>
          <p className="text-[10px] leading-relaxed text-slate-500">
            Hide this layer before publishing if it should not appear on the public customer map.
          </p>
        </div>
      )}

      {/* RENDER FOR ROADS */}
      {object_type === 'road' && (
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Road Name
            </label>
            <input
              type="text"
              value={object_data.name || ''}
              onChange={(e) => handleDataChange('name', e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/50 rounded-lg p-2 text-xs text-slate-200 outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Road Preset Type
            </label>
            <select
              value={object_data.roadType || 'secondary'}
              onChange={(e) => {
                const type = e.target.value;
                let width = 30;
                let borderThickness = 5;
                if (type === 'main') { width = 40; borderThickness = 6; }
                else if (type === 'alley') { width = 20; borderThickness = 4; }
                else if (type === 'walkway') { width = 12; borderThickness = 3; }
                
                onUpdateObject({
                  ...selectedObject,
                  object_data: {
                    ...object_data,
                    roadType: type,
                    width,
                    borderThickness
                  }
                });
              }}
              className="w-full bg-slate-950/50 border border-slate-800 rounded-lg p-2 text-xs text-slate-350 outline-none cursor-pointer"
            >
              <option value="main">Main Road (40px)</option>
              <option value="secondary">Secondary Road (30px)</option>
              <option value="alley">Alley (20px)</option>
              <option value="walkway">Walkway (12px)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Custom Width (px)
            </label>
            <input
              type="number"
              value={object_data.width || 30}
              onChange={(e) => handleDataChange('width', parseInt(e.target.value) || 12)}
              className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/50 rounded-lg p-2 text-xs text-slate-200 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Road Fill
              </label>
              <input
                type="color"
                value={object_data.asphaltColor || '#cbd5e1'}
                onChange={(e) => handleDataChange('asphaltColor', e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-800 bg-slate-950/50 p-1.5 outline-none cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Road Border
              </label>
              <input
                type="color"
                value={object_data.borderColor || '#475569'}
                onChange={(e) => handleDataChange('borderColor', e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-800 bg-slate-950/50 p-1.5 outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* RENDER FOR LOTS / HOUSES */}
      {(object_type === 'lot' || object_type === 'house') && (
        <div className="space-y-3">
          <div className={`rounded-xl border p-3.5 ${
            selectedObject.linked_property_id
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-amber-200 bg-amber-50'
          }`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Link Status</p>
            <p className={`mt-1 text-xs font-bold ${
              selectedObject.linked_property_id ? 'text-emerald-700' : 'text-amber-700'
            }`}>
              {selectedObject.linked_property_id
                ? 'Property details linked'
                : 'No property details yet'}
            </p>
            {!selectedObject.linked_property_id && (
              <p className="mt-1 text-[10px] leading-relaxed text-slate-600">
                Create property details in Blueprint Preview, or link an existing record below.
              </p>
            )}
          </div>

          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3.5">
            <h5 className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1 mb-2">
              <LinkIcon className="w-3.5 h-3.5" />
              Link Database Record
            </h5>
            
            {loadingProps ? (
              <span className="text-[10px] text-slate-500 block">Loading properties...</span>
            ) : (
              <select
                value={selectedObject.linked_property_id || ''}
                onChange={(e) => handleLinkProperty(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800/80 rounded-lg p-2 text-xs text-slate-250 outline-none cursor-pointer"
              >
                <option value="">-- Click to Link Property --</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.property_code} (B{p.block_number} L{p.lot_number}) - {p.status}
                  </option>
                ))}
              </select>
            )}
            <p className="text-[9px] text-slate-500 leading-normal mt-1.5 italic">
              Links this blueprint vector polygon directly to dynamic pricing, bookings, and image galleries.
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Property Code
            </label>
            <input
              type="text"
              value={object_data.property_code || ''}
              onChange={(e) => handleDataChange('property_code', e.target.value)}
              placeholder="Auto-filled when linked"
              className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/50 rounded-lg p-2 text-xs text-slate-200 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Block Number
              </label>
              <input
                type="text"
                value={object_data.block_number || ''}
                onChange={(e) => handleLotFieldChange('block_number', e.target.value)}
                placeholder="Admin input"
                className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/50 rounded-lg p-2 text-xs text-slate-200 outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Lot Number
              </label>
              <input
                type="text"
                value={object_data.lot_number || ''}
                onChange={(e) => handleLotFieldChange('lot_number', e.target.value)}
                placeholder="Admin input"
                className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/50 rounded-lg p-2 text-xs text-slate-200 outline-none"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-[10px] leading-relaxed text-slate-500">
            Entering a block and lot number will automatically link this shape when it matches an existing village property.
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Linked Property ID
            </label>
            <input
              type="text"
              value={selectedObject.linked_property_id || ''}
              readOnly
              placeholder="Not linked yet"
              className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/50 rounded-lg p-2 text-xs text-slate-200 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Fill Color
              </label>
              <input
                type="color"
                value={object_data.fillColor || '#10b981'}
                onChange={(e) => handleDataChange('fillColor', e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-800 bg-slate-950/50 p-1.5 outline-none cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Border Color
              </label>
              <input
                type="color"
                value={object_data.borderColor || '#047857'}
                onChange={(e) => handleDataChange('borderColor', e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-800 bg-slate-950/50 p-1.5 outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* RENDER FOR ZONES */}
      {(object_type.startsWith('zone_') || object_type === 'zone') && (
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Zone Label / Name
            </label>
            <input
              type="text"
              value={object_data.label || ''}
              onChange={(e) => handleDataChange('label', e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/50 rounded-lg p-2 text-xs text-slate-200 outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Zone Color Overlay
            </label>
            <input
              type="color"
              value={object_data.color || '#f43f5e'}
              onChange={(e) => handleDataChange('color', e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-800 rounded-lg p-1.5 text-xs outline-none cursor-pointer h-9"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Overlay Opacity
            </label>
            <input
              type="range"
              min="0.1"
              max="0.8"
              step="0.05"
              value={object_data.opacity || 0.3}
              onChange={(e) => handleDataChange('opacity', parseFloat(e.target.value))}
              className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-[10px] text-slate-500 text-right block mt-1">
              {Math.round((object_data.opacity || 0.3) * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* RENDER FOR OTHER ELEMENTS (TREES / TEXT) */}
      {object_type === 'label' && (
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Text Content
            </label>
            <textarea
              rows={3}
              value={object_data.text || 'Label Text'}
              onChange={(e) => handleDataChange('text', e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-800 focus:border-emerald-500/50 rounded-lg p-2 text-xs text-slate-200 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Font Color
            </label>
            <input
              type="color"
              value={object_data.fill || '#ffffff'}
              onChange={(e) => handleDataChange('fill', e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-800 rounded-lg p-1.5 text-xs outline-none cursor-pointer h-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Text Width
              </label>
              <input
                type="number"
                min="40"
                value={Math.round(object_data.width || 180)}
                onChange={(e) => handleDataChange('width', Math.max(40, parseFloat(e.target.value) || 40))}
                className="w-full rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-xs text-slate-200 outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Font Size
              </label>
              <input
                type="number"
                min="8"
                value={Math.round(object_data.fontSize || 13)}
                onChange={(e) => handleDataChange('fontSize', Math.max(8, parseFloat(e.target.value) || 8))}
                className="w-full rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-xs text-slate-200 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Alignment
            </label>
            <select
              value={object_data.align || 'left'}
              onChange={(e) => handleDataChange('align', e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-xs text-slate-200 outline-none"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>
      )}

      {isAmenity && (
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Amenity Name
            </label>
            <input
              type="text"
              value={object_data.displayLabel || object_data.name || amenityDefaults.name}
              onChange={(e) => onUpdateObject({
                ...selectedObject,
                object_data: {
                  ...object_data,
                  name: e.target.value,
                  displayLabel: e.target.value
                }
              })}
              className="w-full rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-xs text-slate-200 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Amenity Type
              </label>
              <select
                value={object_data.amenityType || amenityDefaults.amenityType}
                onChange={(e) => handleDataChange('amenityType', e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-xs text-slate-200 outline-none"
              >
                {AMENITY_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Shape Type
              </label>
              <select
                value={object_data.shapeType || amenityDefaults.shapeType}
                onChange={(e) => handleDataChange('shapeType', e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-xs text-slate-200 outline-none"
              >
                {AMENITY_SHAPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Description
            </label>
            <textarea
              rows={2}
              value={object_data.description || ''}
              onChange={(e) => handleDataChange('description', e.target.value)}
              placeholder="Optional amenity description"
              className="w-full resize-none rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-xs text-slate-200 outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              {amenityDefaults.shapeType === 'polygon' ? 'Polygon Points' : 'Size (px)'}
            </label>
            {amenityDefaults.shapeType === 'polygon' ? (
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-xs text-slate-500">
                {Math.floor((object_data.points?.length || 0) / 2)} points
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="1"
                  value={object_data.width || (object_data.radius ? object_data.radius * 2 : 72)}
                  onChange={(e) => {
                    const width = Math.max(1, parseFloat(e.target.value) || 1);
                    if (['icon', 'circle'].includes(amenityDefaults.shapeType)) {
                      onUpdateObject({
                        ...selectedObject,
                        object_data: {
                          ...object_data,
                          width,
                          height: width,
                          radius: width / 2
                        }
                      });
                    } else {
                      handleDataChange('width', width);
                    }
                  }}
                  aria-label="Amenity width"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-xs text-slate-200 outline-none"
                />
                <input
                  type="number"
                  min="1"
                  value={object_data.height || (object_data.radius ? object_data.radius * 2 : 72)}
                  disabled={['icon', 'circle'].includes(amenityDefaults.shapeType)}
                  onChange={(e) => handleDataChange('height', Math.max(1, parseFloat(e.target.value) || 1))}
                  aria-label="Amenity height"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-xs text-slate-200 outline-none"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Fill Color
              </label>
              <input
                type="color"
                value={object_data.fillColor || object_data.fill || amenityDefaults.fillColor}
                onChange={(e) => handleDataChange('fillColor', e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-800 bg-slate-950/50 p-1.5 outline-none cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Border Color
              </label>
              <input
                type="color"
                value={object_data.borderColor || amenityDefaults.borderColor}
                onChange={(e) => handleDataChange('borderColor', e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-800 bg-slate-950/50 p-1.5 outline-none cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-2">
            {[
              ['showLabel', 'Show label'],
              ['showTooltip', 'Show hover tooltip'],
              ['showInPublicMap', 'Show in public map']
            ].map(([key, label]) => (
              <label key={key} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-[11px] font-semibold text-slate-300">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={object_data[key] ?? (key !== 'showLabel')}
                  onChange={(e) => handleDataChange(key, e.target.checked)}
                  className="h-4 w-4 accent-emerald-600"
                />
              </label>
            ))}
          </div>
        </div>
      )}

    </aside>
  );
}
