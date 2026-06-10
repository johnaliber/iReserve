'use client';

import React from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Eye, EyeOff, ImagePlus, Layers, Lock, Unlock } from 'lucide-react';

function getObjectLabel(object) {
  const data = object.object_data || {};
  if (object.object_type === 'image_layer' || data.kind === 'reference_image') return data.name || 'Image layer';
  if (object.object_type === 'road') return data.name || 'Road';
  if (object.object_type === 'zone') return data.label || 'Hazard zone';
  if (object.object_type === 'label') return data.text || 'Text label';
  if (object.object_type === 'lot' || object.object_type === 'house') {
    if (data.property_code) return data.property_code;
    if (data.block_number && data.lot_number) return `Block ${data.block_number} Lot ${data.lot_number}`;
    return object.object_type === 'house' ? 'House shape' : 'Lot shape';
  }
  return data.name || object.object_type.replaceAll('_', ' ');
}

export default function LayersPanel({
  objects = [],
  setObjects,
  selectedObjectId,
  setSelectedObjectId,
  setSelectedObjectIds,
  onAddImageLayer
}) {
  const [isOpen, setIsOpen] = React.useState(false);

  const updateObject = (objectId, updater) => {
    setObjects?.(
      objects.map((object) => object.id === objectId ? updater(object) : object)
    );
  };

  const moveObject = (objectId, direction) => {
    const current = objects.find((object) => object.id === objectId);
    if (!current) return;

    updateObject(objectId, (object) => ({
      ...object,
      layer_order: Math.max(0, (object.layer_order || 0) + direction)
    }));
  };

  const sortedObjects = [...objects].sort((a, b) => (b.layer_order || 0) - (a.layer_order || 0));

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/30 select-none">
      <button
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-emerald-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Objects</span>
          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-slate-500">{objects.length}</span>
        </div>
        {isOpen ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
      </button>

      {isOpen && (
        <div className="max-h-72 space-y-1 overflow-y-auto border-t border-slate-800 p-2.5">
          <label className="mb-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold text-emerald-300 transition hover:bg-emerald-500/15">
            <ImagePlus className="h-3.5 w-3.5" />
            Add Image Layer
            <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={onAddImageLayer} className="hidden" />
          </label>

          {sortedObjects.length === 0 ? (
            <p className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-[11px] text-slate-500">
              No objects on the canvas yet.
            </p>
          ) : sortedObjects.map((object) => {
            const isSelected = selectedObjectId === object.id;

            return (
              <div
                key={object.id}
                onClick={() => {
                  setSelectedObjectId?.(object.id);
                  setSelectedObjectIds?.([object.id]);
                }}
                className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition cursor-pointer ${
                  isSelected
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <button
                  title={object.is_visible === false ? 'Show object' : 'Hide object'}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateObject(object.id, (item) => ({ ...item, is_visible: item.is_visible === false }));
                  }}
                  className="text-slate-500 hover:text-white"
                >
                  {object.is_visible === false ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>

                <button
                  title={object.is_locked ? 'Unlock object' : 'Lock object'}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateObject(object.id, (item) => ({ ...item, is_locked: !item.is_locked }));
                  }}
                  className="text-slate-500 hover:text-white"
                >
                  {object.is_locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                </button>

                <span className="min-w-0 flex-1 truncate font-semibold capitalize">{getObjectLabel(object)}</span>

                <button
                  title="Bring forward"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveObject(object.id, 1);
                  }}
                  className="text-slate-500 hover:text-emerald-300"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  title="Send backward"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveObject(object.id, -1);
                  }}
                  className="text-slate-500 hover:text-emerald-300"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
