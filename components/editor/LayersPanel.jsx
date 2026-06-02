'use client';

import React from 'react';
import { Eye, EyeOff, Layers, ShieldAlert, Sun, Trees, Compass } from 'lucide-react';

export default function LayersPanel({ layers, setLayers }) {
  const toggleLayer = (layerId) => {
    setLayers({
      ...layers,
      [layerId]: !layers[layerId]
    });
  };

  const layerItems = [
    { id: 'roads', name: 'Road System Layout', icon: Layers, color: 'text-slate-400' },
    { id: 'lots', name: 'Lot Boundaries & Status', icon: Layers, color: 'text-emerald-400' },
    { id: 'amenities', name: 'Amenity Markers', icon: Trees, color: 'text-teal-400' },
    { id: 'flood', name: 'Flood Risk Overlays', icon: ShieldAlert, color: 'text-rose-400' },
    { id: 'sunlight', name: 'Sunlight Directions', icon: Compass, color: 'text-amber-400' }
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 w-60 shadow-lg select-none glass-card">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 mb-3">
        <Layers className="w-4 h-4 text-emerald-400" />
        <span className="text-xs font-bold text-slate-350 uppercase tracking-wider">
          Blueprint Layers
        </span>
      </div>

      <div className="space-y-2">
        {layerItems.map((item) => {
          const Icon = item.icon;
          const isVisible = layers[item.id] !== false;
          
          return (
            <div
              key={item.id}
              onClick={() => toggleLayer(item.id)}
              className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer select-none ${
                isVisible
                  ? 'bg-slate-950/60 border-slate-850 text-slate-200 hover:border-emerald-500/20'
                  : 'bg-slate-950/20 border-transparent text-slate-600 hover:text-slate-400'
              }`}
            >
              <div className="flex items-center gap-2.5 text-xs font-semibold">
                <Icon className={`w-4 h-4 ${isVisible ? item.color : 'text-slate-700'}`} />
                <span>{item.name}</span>
              </div>
              <button
                className="outline-none cursor-pointer p-0.5 text-slate-500 hover:text-white transition"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLayer(item.id);
                }}
              >
                {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
