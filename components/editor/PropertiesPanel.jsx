'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Trash2, Link as LinkIcon, Shield, Unlock, Lock, HelpCircle } from 'lucide-react';

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
      <aside className="w-[352px] bg-slate-900 border-l border-slate-800/80 p-6 flex flex-col justify-center items-center text-center text-slate-500 select-none">
        <HelpCircle className="w-10 h-10 mb-3 text-slate-700" />
        <h4 className="text-sm font-semibold text-slate-400">No Object Selected</h4>
        <p className="text-[11px] mt-1 leading-normal max-w-[160px]">
          Click any element on the blueprint workspace to inspect and edit its properties.
        </p>
      </aside>
    );
  }

  const { object_type, object_data = {}, is_locked = false } = selectedObject;
  const isImageLayer = object_type === 'image_layer' || (object_type === 'landmark' && object_data.kind === 'reference_image');

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
    <aside className="w-[352px] bg-slate-900 border-l border-slate-800/80 p-5 flex flex-col select-none gap-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Properties Panel
        </span>
        <div className="flex gap-1">
          <button
            onClick={handleLockToggle}
            title={is_locked ? 'Unlock Object' : 'Lock Position'}
            className={`p-1.5 rounded-lg border transition outline-none cursor-pointer ${
              is_locked 
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                : 'bg-slate-950/20 border-slate-850 text-slate-500 hover:text-slate-300'
            }`}
          >
            {is_locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onDeleteObject(selectedObject.id)}
            title="Delete Element"
            className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition outline-none cursor-pointer"
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
        <div className="space-y-4 rounded-xl border border-sky-500/10 bg-sky-500/5 p-3.5">
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
        <div className="space-y-4">
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
        <div className="space-y-4">
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
        <div className="space-y-4">
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
        <div className="space-y-4">
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
        </div>
      )}

      {['tree', 'street_light', 'guard_house', 'clubhouse', 'pool', 'park', 'amenity', 'landmark'].includes(object_type) && object_data.kind !== 'reference_image' && (
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Size Diameter (px)
            </label>
            <input
              type="number"
              value={object_data.radius * 2 || object_data.width || 30}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 20;
                if (object_data.radius) {
                  handleDataChange('radius', val / 2);
                } else {
                  handleDataChange('width', val);
                  handleDataChange('height', val);
                }
              }}
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
                value={object_data.fill || '#10b981'}
                onChange={(e) => handleDataChange('fill', e.target.value)}
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

    </aside>
  );
}
