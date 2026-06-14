'use client';

import { Download, FileSpreadsheet, FileText, Loader2, Play } from 'lucide-react';

export default function ReportExportButtons({
  reportType,
  filters,
  onExport,
  onGenerate,
  isGenerating = false,
  disabled = false
}) {
  const busy = isGenerating || disabled;
  const buttonClass = 'inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-extrabold transition disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className="flex flex-wrap gap-2" data-report-type={reportType} data-filter-count={Object.keys(filters || {}).length}>
      <button type="button" disabled={busy} onClick={onGenerate} className={`${buttonClass} bg-emerald-600 text-white hover:bg-emerald-500`}>
        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        Generate Report
      </button>
      <button type="button" disabled={busy} onClick={() => onExport('pdf')} className={`${buttonClass} border border-[#d8e1dd] bg-white text-[#24332c]`}>
        <FileText className="h-4 w-4 text-rose-600" /> Export PDF
      </button>
      <button type="button" disabled={busy} onClick={() => onExport('xlsx')} className={`${buttonClass} border border-[#d8e1dd] bg-white text-[#24332c]`}>
        <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Export Excel
      </button>
      <button type="button" disabled={busy} onClick={() => onExport('csv')} className={`${buttonClass} border border-[#d8e1dd] bg-white text-[#24332c]`}>
        <Download className="h-4 w-4 text-sky-600" /> Export CSV
      </button>
    </div>
  );
}

