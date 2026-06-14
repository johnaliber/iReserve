'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { FileText, Minus, Plus, RotateCcw } from 'lucide-react';
import { buildReportDocumentModel } from '@/lib/reports/reportDocument';

function chunkRows(rows, size) {
  const pages = [];
  for (let index = 0; index < rows.length; index += size) pages.push(rows.slice(index, index + size));
  return pages.length ? pages : [[]];
}

function paginatePreviewRows(model, reportType, spacingMultiplier, fontMultiplier) {
  const rows = model.rows.slice(0, 96);
  const isFinancialLandscape = reportType === 'financial_management_report'
    && model.page.orientation === 'landscape';

  if (!isFinancialLandscape) {
    const rowsPerPage = Math.max(
      6,
      Math.floor((model.page.orientation === 'landscape' ? 10 : 16) * spacingMultiplier * fontMultiplier)
    );
    return chunkRows(rows, rowsPerPage);
  }

  // The financial report has a summary and ten wrapping columns. Keep the
  // details table together on continuation pages instead of clipping it.
  const continuationSize = Math.max(4, Math.floor(7 * spacingMultiplier * fontMultiplier));
  return [
    [],
    ...chunkRows(rows, continuationSize)
  ];
}

function DocumentPage({ model, rows, pageNumber, pageCount, zoom }) {
  const { page, typography, theme } = model;
  const ratio = page.width / page.height;

  return (
    <article
      className={`relative mx-auto w-full overflow-hidden bg-white shadow-[0_18px_55px_rgba(25,55,42,0.18)] ${
        page.orientation === 'landscape' ? 'max-w-[900px]' : 'max-w-[620px]'
      }`}
      style={{
        aspectRatio: `${ratio} / 1`,
        fontFamily: typography.fontFamily,
        zoom: zoom / 100,
        padding: `${(page.pageMargin / page.height) * 100}% ${(page.pageMargin / page.width) * 100}%`
      }}
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <Image src="/brand/ireserve-watermark.jpg" alt="" width={600} height={400} className="w-[58%] object-contain" />
      </div>

      <div className="relative z-10 flex h-full flex-col">
        {pageNumber === 1 ? (
          <>
            <Image
              src={model.brand.image}
              alt={model.brand.alt}
              width={420}
              height={62}
              className="h-auto w-[52%] object-contain object-left"
            />

            <div style={{ marginTop: `${page.sectionGap * 1.8}px` }}>
              <h1 className="font-black leading-tight" style={{ color: theme.text, fontSize: `${typography.titleSize}px` }}>{model.title}</h1>
              <p className="mt-1 leading-relaxed" style={{ color: theme.muted, fontSize: `${Math.max(5.5, typography.bodySize - 1)}px` }}>
                Applied Filters: {model.filters.map((item) => `${item.label}: ${item.value}`).join(' | ')}
              </p>
              <div className="mt-1 h-px" style={{ backgroundColor: theme.accent }} />
            </div>

            <table className="w-full table-fixed border-collapse" style={{ marginTop: `${page.sectionGap / 2}px`, fontSize: `${typography.bodySize}px` }}>
              <thead>
                <tr style={{ backgroundColor: theme.header, color: theme.headerText }}>
                  {model.metadata.map((item) => (
                    <th key={item.label} className="border px-1 py-1 text-center font-extrabold" style={{ borderColor: theme.border }}>{item.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {model.metadata.map((item) => (
                    <td key={item.label} className="border px-1 py-1 text-center font-semibold" style={{ borderColor: theme.border }}>{item.value}</td>
                  ))}
                </tr>
              </tbody>
            </table>

            {model.summary.length > 0 && (
              <section style={{ marginTop: `${page.sectionGap}px` }}>
                <h2 className="font-black" style={{ color: theme.text, fontSize: `${typography.sectionSize}px` }}>Summary</h2>
                <table className="mt-1 w-full border-collapse" style={{ fontSize: `${typography.bodySize}px` }}>
                  <thead>
                    <tr style={{ backgroundColor: theme.header, color: theme.headerText }}>
                      <th className="border px-1 py-1 text-left" style={{ borderColor: theme.border }}>Metric</th>
                      <th className="border px-1 py-1 text-left" style={{ borderColor: theme.border }}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.summary.map((item) => (
                      <tr key={item.label}>
                        <td className="border px-1 py-1" style={{ borderColor: theme.border }}>{item.label}</td>
                        <td className="border px-1 py-1 font-semibold" style={{ borderColor: theme.border }}>{item.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </>
        ) : (
          <div className="border-b pb-1" style={{ borderColor: theme.border }}>
            <p className="font-bold" style={{ color: theme.accent, fontSize: `${typography.bodySize}px` }}>{model.title} · Continued</p>
          </div>
        )}

        {rows.length > 0 && (
          <section style={{ marginTop: `${page.sectionGap}px` }}>
            <h2 className="font-black" style={{ color: theme.text, fontSize: `${typography.sectionSize}px` }}>Report Details</h2>
            <table className="mt-1 w-full table-fixed border-collapse text-left" style={{ fontSize: `${typography.tableSize}px` }}>
              <colgroup>
                {model.columns.map((column) => <col key={column.key} style={{ width: `${column.width}%` }} />)}
              </colgroup>
              <thead>
                <tr style={{ backgroundColor: theme.header, color: theme.headerText }}>
                  {model.columns.map((column) => (
                    <th key={column.key} className="break-words border text-center font-extrabold leading-tight [overflow-wrap:anywhere]" style={{ borderColor: theme.border, padding: `${page.cellPadding}px` }}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex} style={{ backgroundColor: rowIndex % 2 ? theme.stripe : '#FFFFFF' }}>
                    {row.map((value, columnIndex) => (
                      <td key={model.columns[columnIndex].key} className="break-words border align-top leading-tight [overflow-wrap:anywhere]" style={{ borderColor: theme.border, padding: `${page.cellPadding}px` }}>{value}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <footer className="mt-auto flex justify-between border-t pt-1" style={{ borderColor: theme.border, color: theme.muted, fontSize: `${Math.max(5, typography.bodySize - 1.5)}px` }}>
          <span>{model.footer}</span>
          <span>Page {pageNumber} of {pageCount}</span>
        </footer>
      </div>
    </article>
  );
}

export default function ReportPreview({
  report,
  filters = {},
  generatedAt,
  currentUser,
  availableVillages = [],
  availableProperties = [],
  availableCustomers = [],
  presentation
}) {
  const [zoom, setZoom] = useState(100);
  const village = availableVillages.find((item) => item.id === filters.villageId);
  const villageScope = village?.name || (currentUser?.role === 'super_admin' ? 'All villages' : 'All permitted villages');
  const model = useMemo(() => report ? buildReportDocumentModel({
    report,
    filters,
    presentation,
    generatedAt,
    generatedBy: currentUser?.name,
    role: currentUser?.role,
    villageScope,
    lookups: {
      villages: availableVillages,
      properties: availableProperties,
      customers: availableCustomers
    }
  }) : null, [
    availableCustomers,
    availableProperties,
    availableVillages,
    currentUser,
    filters,
    generatedAt,
    presentation,
    report,
    villageScope
  ]);

  if (!model) {
    return <div className="rounded-2xl border border-dashed border-[#cfdad5] bg-white p-12 text-center text-sm font-semibold text-[#66756e]">Choose a report and generate it to preview the printable file.</div>;
  }

  const spacingMultiplier = presentation.spacing === 'compact' ? 1.25 : presentation.spacing === 'comfortable' ? 0.8 : 1;
  const fontMultiplier = 11 / Number(presentation.baseFontSize || 11);
  const pages = paginatePreviewRows(model, report.reportType, spacingMultiplier, fontMultiplier);

  return (
    <section className="overflow-hidden rounded-2xl border border-[#cfdad5] bg-[#dfe7e3] shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#c4d1cb] bg-[#f8faf9] px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-rose-600" />
          <div>
            <p className="text-xs font-extrabold text-[#24332c]">Print preview</p>
            <p className="text-[10px] font-semibold text-[#66756e]">{presentation.paperSize.toUpperCase()} {model.page.orientation} · {presentation.fontFamily} {presentation.baseFontSize} pt</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#66756e]">
          <span className="mr-1">{pages.length} page{pages.length === 1 ? '' : 's'}</span>
          <button type="button" onClick={() => setZoom((value) => Math.max(50, value - 10))} className="rounded-lg border border-[#d5dfda] bg-white p-1.5 hover:bg-[#eef6f2]" aria-label="Zoom out"><Minus className="h-3.5 w-3.5" /></button>
          <select value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="h-7 rounded-lg border border-[#d5dfda] bg-white px-2 text-[10px] font-bold">
            {[50, 75, 90, 100, 110, 125, 150].map((value) => <option key={value} value={value}>{value}%</option>)}
          </select>
          <button type="button" onClick={() => setZoom((value) => Math.min(150, value + 10))} className="rounded-lg border border-[#d5dfda] bg-white p-1.5 hover:bg-[#eef6f2]" aria-label="Zoom in"><Plus className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => setZoom(100)} className="rounded-lg border border-[#d5dfda] bg-white p-1.5 hover:bg-[#eef6f2]" aria-label="Reset zoom"><RotateCcw className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <div className="max-h-[820px] space-y-6 overflow-auto p-4 md:p-6">
        {pages.map((rows, index) => <DocumentPage key={index} model={model} rows={rows} pageNumber={index + 1} pageCount={pages.length} zoom={zoom} />)}
        {model.rows.length > 96 && <p className="text-center text-xs font-bold text-[#52635b]">Preview limited to 96 records. The exported file contains every filtered record.</p>}
      </div>
    </section>
  );
}
