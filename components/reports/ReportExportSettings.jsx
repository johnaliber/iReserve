'use client';

import { LayoutTemplate, Type } from 'lucide-react';

const OPTIONS = {
  fontFamily: [
    ['Arial', 'Arial'],
    ['Helvetica', 'Helvetica'],
    ['Times New Roman', 'Times New Roman'],
    ['Courier New', 'Courier New']
  ],
  baseFontSize: [
    ['9', '9 pt'],
    ['10', '10 pt'],
    ['11', '11 pt'],
    ['12', '12 pt']
  ],
  paperSize: [
    ['a4', 'A4'],
    ['letter', 'Letter'],
    ['legal', 'Legal']
  ],
  orientation: [
    ['portrait', 'Portrait'],
    ['landscape', 'Landscape']
  ],
  spacing: [
    ['compact', 'Compact'],
    ['balanced', 'Balanced'],
    ['comfortable', 'Comfortable']
  ],
  headerTheme: [
    ['property_accent', 'iReserve Green'],
    ['fresh_lime', 'Fresh Lime'],
    ['emerald', 'Emerald'],
    ['teal', 'Deep Teal'],
    ['sage', 'Soft Sage'],
    ['navy', 'Executive Navy'],
    ['slate', 'Neutral Slate']
  ]
};

function SettingSelect({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#24332c]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-[#d8e1dd] bg-white px-3 text-sm font-semibold text-[#24332c] shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

export default function ReportExportSettings({ presentation, onChange }) {
  const set = (key, value) => onChange({ ...presentation, [key]: value });

  return (
    <aside className="overflow-hidden rounded-2xl border border-[#d8e1dd] bg-white shadow-sm">
      <div className="border-b border-[#e5ebe8] px-5 py-4">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-700">Export Settings</p>
        <h2 className="mt-1 text-lg font-extrabold text-[#17211d]">Typography And Layout</h2>
        <p className="mt-1 text-xs leading-5 text-[#66756e]">
          Adjust the export presentation. The preview updates from the same settings used for download.
        </p>
      </div>

      <div className="space-y-4 p-4">
        <section className="space-y-3 rounded-2xl border border-[#e0e6e3] bg-[#f8faf9] p-4">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-extrabold text-[#24332c]">Typography</h3>
          </div>
          <SettingSelect label="Font Family" value={presentation.fontFamily} options={OPTIONS.fontFamily} onChange={(value) => set('fontFamily', value)} />
          <SettingSelect label="Base Font Size" value={presentation.baseFontSize} options={OPTIONS.baseFontSize} onChange={(value) => set('baseFontSize', value)} />
        </section>

        <section className="space-y-3 rounded-2xl border border-[#e0e6e3] bg-[#f8faf9] p-4">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-extrabold text-[#24332c]">Page Setup</h3>
          </div>
          <SettingSelect label="Paper Size" value={presentation.paperSize} options={OPTIONS.paperSize} onChange={(value) => set('paperSize', value)} />
          <SettingSelect label="Orientation" value={presentation.orientation} options={OPTIONS.orientation} onChange={(value) => set('orientation', value)} />
          <SettingSelect label="Spacing Profile" value={presentation.spacing} options={OPTIONS.spacing} onChange={(value) => set('spacing', value)} />
          <SettingSelect label="Accent Theme" value={presentation.headerTheme} options={OPTIONS.headerTheme} onChange={(value) => set('headerTheme', value)} />
        </section>
      </div>
    </aside>
  );
}
