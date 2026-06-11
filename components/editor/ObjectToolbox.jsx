'use client';

import React from 'react';
import { 
  MousePointer, 
  Trees, 
  Layers, 
  Type, 
  Building,
  Navigation,
  Compass,
  AlertTriangle,
  Lightbulb,
  Home,
  Waves,
  Volume2
} from 'lucide-react';
import { AMENITY_SHAPES } from '@/lib/blueprints/amenities';

export default function ObjectToolbox({
  activeTool,
  setActiveTool,
  amenityShapeMode = 'icon',
  setAmenityShapeMode
}) {
  const tools = [
    { id: 'select', name: 'Select / Move', icon: MousePointer, category: 'general', shortcut: 'S / 1' },
    { id: 'multi_select', name: 'Multi-Select', icon: MultiSelectIcon, category: 'general', shortcut: 'M' },
    { id: 'pan', name: 'Pan Workspace', icon: Navigation, category: 'general', shortcut: 'Spacebar / P' },
    
    { id: 'road_straight', name: 'Straight Road', icon: Layers, category: 'roads', shortcut: 'R' },
    { id: 'road_curved', name: 'Curved Road', icon: Compass, category: 'roads', shortcut: 'C' },
    
    { id: 'lot_polygon', name: 'Lot Polygon', icon: Home, category: 'lots', shortcut: 'L' },
    { id: 'lot_rect', name: 'Rectangle Lot', icon: Building, category: 'lots', shortcut: 'K' },
    
    { id: 'amenity_tree', name: 'Plant Tree', icon: Trees, category: 'amenities', shortcut: 'T' },
    { id: 'amenity_clubhouse', name: 'Clubhouse', icon: Building, category: 'amenities', shortcut: 'H' },
    { id: 'amenity_pool', name: 'Swimming Pool', icon: Waves, category: 'amenities', shortcut: 'W' },
    { id: 'amenity_guard', name: 'Guard House', icon: ShieldAlertIcon, category: 'amenities', shortcut: 'G' },
    { id: 'amenity_light', name: 'Street Light', icon: Lightbulb, category: 'amenities', shortcut: 'I' },
    
    { id: 'label_text', name: 'Label / Text', icon: Type, category: 'general', shortcut: 'O' },
    
    { id: 'zone_flood', name: 'Flood Zone', icon: AlertTriangle, category: 'zones', shortcut: 'F' },
    { id: 'zone_noise', name: 'Noise Zone', icon: Volume2, category: 'zones', shortcut: 'N' }
  ];

  function ShieldAlertIcon(props) {
    return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 13c0 5-3.5 7.5-7.66 9.7a1 1 0 0 1-.68 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 .76-.97l8-2a1 1 0 0 1 .48 0l8 2A1 1 0 0 1 20 6z" />
        <line x1="12" x2="12" y1="9" y2="13" />
        <line x1="12" x2="12.01" y1="17" y2="17" />
      </svg>
    );
  }

  const renderSection = (categoryName, categoryId) => {
    const filteredTools = tools.filter(t => t.category === categoryId);
    return (
      <div className="space-y-2">
        <span className="block px-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-600">
          {categoryName}
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {filteredTools.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                title={`${tool.name} (Shortcut: ${tool.shortcut})`}
                className={`group flex min-h-14 flex-col items-center justify-center rounded-lg border px-1.5 py-2 text-[10px] font-semibold outline-none transition ${
                  isActive
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 shadow-sm'
                    : 'border-transparent bg-slate-50 text-slate-700 hover:border-slate-200 hover:bg-white hover:shadow-sm'
                }`}
              >
                <Icon className={`mb-1 h-4 w-4 transition-transform group-hover:scale-105 ${isActive ? 'text-emerald-700' : 'text-slate-600'}`} />
                <span className="w-full truncate text-center">{tool.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <aside className="editor-toolbox-scroll flex h-full min-h-0 w-44 flex-shrink-0 select-none flex-col gap-3 overflow-x-hidden overflow-y-auto bg-white p-3 pt-12">
      {renderSection('Controls', 'general')}
      <hr className="border-slate-200" />
      {renderSection('Subdivision Roads', 'roads')}
      <hr className="border-slate-200" />
      {renderSection('Property Lots', 'lots')}
      <hr className="border-slate-200" />
      <div className="space-y-2">
        <label className="block px-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-600">
          Amenity Drawing Mode
        </label>
        <select
          value={amenityShapeMode}
          onChange={(event) => setAmenityShapeMode?.(event.target.value)}
          className="h-9 w-full rounded-lg border border-[#cbd5e1] bg-white px-2 text-[11px] font-semibold text-[#334155] outline-none focus:border-emerald-500"
        >
          {AMENITY_SHAPES.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <p className="px-1 text-[10px] leading-4 text-[#64748b]">
          Choose a shape, then select an amenity below.
        </p>
      </div>
      {renderSection('Amenities', 'amenities')}
      <hr className="border-slate-200" />
      {renderSection('Hazards & Zones', 'zones')}
    </aside>
  );
}

function MultiSelectIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="8" height="8" x="14" y="2" rx="1" />
      <rect width="8" height="8" x="2" y="14" rx="1" />
      <path d="M7 2h1a2 2 0 0 1 2 2v1" />
      <path d="M2 7V6a2 2 0 0 1 2-2h1" />
    </svg>
  );
}
