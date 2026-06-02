'use client';

import React from 'react';
import { 
  MousePointer, 
  MapPin, 
  Trees, 
  Layers, 
  Type, 
  Eye, 
  EyeOff, 
  Building,
  Flag,
  Navigation,
  Compass,
  AlertTriangle,
  Lightbulb,
  Home,
  Waves,
  Volume2
} from 'lucide-react';

export default function ObjectToolbox({ activeTool, setActiveTool }) {
  const tools = [
    { id: 'select', name: 'Select / Move', icon: MousePointer, category: 'general', shortcut: 'S / 1' },
    { id: 'multi_select', name: 'Multi-Select', icon: MultiSelectIcon, category: 'general', shortcut: 'M' },
    { id: 'pan', name: 'Pan Workspace', icon: Navigation, category: 'general', shortcut: 'P / 2' },
    
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
      <div className="space-y-1.5">
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block px-2 mb-1.5">
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
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-[10px] font-semibold transition group outline-none cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-slate-950/40 border-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className={`w-4.5 h-4.5 mb-1 group-hover:scale-110 transition-transform ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span className="truncate w-full text-center">{tool.name.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <aside className="w-52 bg-slate-900 border-r border-slate-800/80 p-4 flex flex-col gap-6 overflow-y-auto select-none">
      {renderSection('Controls', 'general')}
      <hr className="border-slate-800/60" />
      {renderSection('Subdivision Roads', 'roads')}
      <hr className="border-slate-800/60" />
      {renderSection('Property Lots', 'lots')}
      <hr className="border-slate-800/60" />
      {renderSection('Amenities', 'amenities')}
      <hr className="border-slate-800/60" />
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
