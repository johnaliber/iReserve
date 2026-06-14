'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Building2,
  CheckCircle2,
  FileCheck2,
  Home,
  Loader2,
  ReceiptText,
  ShieldCheck,
  TrendingUp,
  XCircle
} from 'lucide-react';
import {
  REPORT_CATALOGS,
  REPORT_DEFINITIONS
} from '@/lib/reports/reportDefinitions';
import ReportExportButtons from './ReportExportButtons';
import ReportExportSettings from './ReportExportSettings';
import ReportFilterPanel from './ReportFilterPanel';
import ReportPreview from './ReportPreview';

function defaultFilters(role, villages) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    datePreset: 'month',
    dateFrom: start.toISOString().slice(0, 10),
    dateTo: now.toISOString().slice(0, 10),
    villageId: role === 'super_admin' ? '' : villages[0]?.id || '',
    sortBy: 'newest',
    search: ''
  };
}

const DEFAULT_PRESENTATION = {
  fontFamily: 'Arial',
  baseFontSize: '11',
  paperSize: 'a4',
  orientation: 'portrait',
  spacing: 'balanced',
  headerTheme: 'property_accent'
};

const REPORT_ICONS = {
  village_performance_report: Building2,
  property_report: Home,
  financial_management_report: FileCheck2,
  trends_report: TrendingUp,
  customer_payment_report: ReceiptText,
  audit_logs_report: ShieldCheck
};

export default function ReportCenter({ accountingOnly = false }) {
  const [options, setOptions] = useState(null);
  const [reportType, setReportType] = useState('');
  const [filters, setFilters] = useState({});
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [presentation, setPresentation] = useState(DEFAULT_PRESENTATION);

  useEffect(() => {
    async function loadOptions() {
      try {
        const response = await fetch('/api/reports/generate', { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Report filters could not be loaded.');
        const catalog = REPORT_CATALOGS[payload.role] || [];
        const scopedCatalog = accountingOnly ? REPORT_CATALOGS.accounting : catalog;
        setOptions(payload);
        setReportType(scopedCatalog[0] || '');
        setFilters(defaultFilters(payload.role, payload.villages));
      } catch (error) {
        setNotice({ type: 'error', message: error.message });
      } finally {
        setLoading(false);
      }
    }
    loadOptions();
  }, [accountingOnly]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const definition = REPORT_DEFINITIONS[reportType];
  const catalog = useMemo(() => {
    if (!options) return [];
    return accountingOnly ? REPORT_CATALOGS.accounting : (REPORT_CATALOGS[options.role] || []);
  }, [accountingOnly, options]);

  const generateReport = useCallback(async () => {
    if (!reportType) return;
    setGenerating(true);
    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType, filters })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to generate report.');
      setReport(payload.report);
      setGeneratedAt(new Date(payload.generatedAt));
      setNotice({ type: 'success', message: `${payload.report.title} generated successfully.` });
    } catch (error) {
      setReport(null);
      setNotice({ type: 'error', message: error.message });
    } finally {
      setGenerating(false);
    }
  }, [filters, reportType]);

  const exportReport = useCallback(async (format) => {
    if (!reportType) return;
    setGenerating(true);
    try {
      const response = await fetch(`/api/reports/export/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType, filters, presentation, generatedAt: generatedAt?.toISOString() })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to generate report.');
      }
      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      const filename = disposition.match(/filename="([^"]+)"/)?.[1]
        || `${reportType}-${new Date().toISOString().slice(0, 10)}.${format}`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setNotice({ type: 'success', message: `${definition.title} exported as ${format.toUpperCase()}.` });
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
    } finally {
      setGenerating(false);
    }
  }, [definition, filters, generatedAt, presentation, reportType]);

  if (loading) {
    return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-emerald-600" /></div>;
  }
  if (!options || !reportType) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-700">{notice?.message || 'No reports are available.'}</div>;
  }

  return (
    <div className="space-y-5">
      {notice && (
        <div className={`fixed right-5 top-5 z-[100] flex max-w-md items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold shadow-xl ${
          notice.type === 'success' ? 'border-emerald-200 bg-white text-emerald-700' : 'border-rose-200 bg-white text-rose-700'
        }`}>
          {notice.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
          {notice.message}
        </div>
      )}

      <div className="px-6 py-7 text-white md:px-8">
          <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-600">
            <BarChart3 className="h-4 w-4" /> Reporting Workspace
          </p>
          <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Professional reports, ready for review</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66756e]">
            Select a predefined report, refine the permitted records, review the final page layout, and export through Paperdoc.
          </p>
        </div>

      <div className="overflow-hidden rounded-3xl border border-[#d5e0da] bg-white shadow-sm">
        
        <div className="p-5 md:p-6">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-700">Step 1</p>
              <h2 className="mt-1 text-lg font-extrabold text-[#17211d]">Choose a predefined report</h2>
            </div>
            <span className="rounded-full bg-[#eef6f2] px-3 py-1 text-[10px] font-bold text-[#52635b]">{catalog.length} available</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {catalog.map((key) => {
              const item = REPORT_DEFINITIONS[key];
              const Icon = REPORT_ICONS[key] || BarChart3;
              const selected = reportType === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setReportType(key);
                    setReport(null);
                    setGeneratedAt(null);
                    setFilters(defaultFilters(options.role, options.villages));
                  }}
                  className={`group flex min-h-28 items-start gap-3 rounded-2xl border p-4 text-left transition ${
                    selected
                      ? 'border-emerald-500 bg-emerald-50 shadow-[0_8px_24px_rgba(22,131,95,0.12)]'
                      : 'border-[#dde5e1] bg-[#fbfcfb] hover:border-emerald-300 hover:bg-white'
                  }`}
                >
                  <span className={`rounded-xl p-2.5 ${selected ? 'bg-emerald-600 text-white' : 'bg-[#edf3f0] text-[#52635b] group-hover:text-emerald-700'}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-extrabold text-[#24332c]">{item.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-[#66756e]">{item.subtitle}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-700">Step 2 · Refine report data</p>
      <ReportFilterPanel
        reportType={reportType}
        filters={filters}
        onFilterChange={setFilters}
        onApplyFilters={generateReport}
        onResetFilters={() => {
          setFilters(defaultFilters(options.role, options.villages));
          setReport(null);
          setGeneratedAt(null);
        }}
        availableVillages={options.villages}
        availableStatuses={definition.statuses}
        availableProperties={options.properties}
        availableCustomers={options.customers}
        availableUsers={options.users}
        currentUserRole={options.role}
      />
      </div>

      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[#d8e1dd] bg-white p-4 shadow-sm lg:flex-row lg:items-center">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-700">Step 3 · Generate or export</p>
          <p className="mt-1 text-xs text-[#66756e]">The preview and downloaded document use the selected filters and presentation settings.</p>
        </div>
        <ReportExportButtons
          reportType={reportType}
          filters={filters}
          onGenerate={generateReport}
          onExport={exportReport}
          isGenerating={generating}
        />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[310px_minmax(0,1fr)]">
        <div className="xl:sticky xl:top-4">
          <ReportExportSettings presentation={presentation} onChange={setPresentation} />
        </div>
        <ReportPreview
          report={report}
          filters={filters}
          presentation={presentation}
          generatedAt={generatedAt}
          currentUser={options.currentUser}
          availableVillages={options.villages}
          availableProperties={options.properties}
          availableCustomers={options.customers}
        />
      </div>
    </div>
  );
}
