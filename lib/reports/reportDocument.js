export const REPORT_THEME_TOKENS = {
  property_accent: { accent: '#16835F', header: '#BFE8D8', headerText: '#173E31', border: '#8ECBB5', stripe: '#F4F8F6', text: '#17211D', muted: '#66756E' },
  fresh_lime: { accent: '#527D16', header: '#D4FF8A', headerText: '#17211D', border: '#B9DF75', stripe: '#FAFFF1', text: '#17211D', muted: '#66756E' },
  emerald: { accent: '#047857', header: '#A7F3D0', headerText: '#064E3B', border: '#6EE7B7', stripe: '#F0FDF8', text: '#17211D', muted: '#66756E' },
  teal: { accent: '#0F766E', header: '#99F6E4', headerText: '#134E4A', border: '#5EEAD4', stripe: '#F0FDFA', text: '#17211D', muted: '#66756E' },
  sage: { accent: '#52725A', header: '#CFE3C9', headerText: '#29452D', border: '#ADC9A5', stripe: '#F5F8F4', text: '#17211D', muted: '#66756E' },
  navy: { accent: '#1E3A5F', header: '#BFDBFE', headerText: '#172B45', border: '#93C5FD', stripe: '#F3F7FC', text: '#17211D', muted: '#66756E' },
  slate: { accent: '#475569', header: '#CBD5E1', headerText: '#1E293B', border: '#94A3B8', stripe: '#F8FAFC', text: '#17211D', muted: '#66756E' }
};

const PAPER = {
  a4: { width: 210, height: 297 },
  letter: { width: 215.9, height: 279.4 },
  legal: { width: 215.9, height: 355.6 }
};

function titleCase(value) {
  return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function displayValue(value, type, key = '') {
  if (value === null || value === undefined || value === '') return '-';
  if (type === 'currency') return `PHP ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (type === 'number') return Number(value || 0).toLocaleString('en-US');
  if (type === 'date' || type === 'datetime') {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return type === 'datetime'
      ? date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' })
      : date.toLocaleDateString('en-US', { dateStyle: 'medium' });
  }
  const normalized = String(value).replaceAll('_', ' ');
  return /status|type|purpose|method/i.test(key) ? titleCase(normalized) : normalized;
}

function columnWeights(columns) {
  const weights = columns.map((column) => {
    const key = String(column.key || '').toLowerCase();
    const label = String(column.label || '').toLowerCase();
    if (['description', 'message', 'rejectionreason'].some((value) => key.includes(value))) return 2;
    if (['customer', 'village', 'property', 'reference'].some((value) => key.includes(value))) return 1.45;
    if (column.type === 'currency') return 1.3;
    if (column.type === 'datetime') return 1.35;
    if (column.type === 'date' || key.includes('status') || label.includes('status')) return 1.15;
    if (column.type === 'number') return 0.85;
    return 1;
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map((weight) => Number(((weight / total) * 100).toFixed(3)));
}

function filterItems(filters, lookups) {
  const village = lookups.villages?.find((item) => item.id === filters.villageId);
  const property = lookups.properties?.find((item) => item.id === filters.propertyId);
  const customer = lookups.customers?.find((item) => item.id === filters.customerId);
  const items = [];
  if (filters.dateFrom) items.push({ label: 'Date From', value: filters.dateFrom });
  if (filters.dateTo) items.push({ label: 'Date To', value: filters.dateTo });
  items.push({ label: 'Sort By', value: titleCase(filters.sortBy || 'newest') });
  items.push({ label: 'Village', value: village?.name || lookups.villageScope || 'All permitted villages' });
  if (property || filters.propertyId) items.push({ label: 'Property', value: property?.property_code || filters.propertyId });
  if (customer || filters.customerId) items.push({ label: 'Customer', value: customer?.name || filters.customerId });
  for (const key of ['status', 'paymentStatus', 'reservationStatus', 'paymentType']) {
    if (filters[key]) items.push({ label: titleCase(key.replace(/([A-Z])/g, ' $1')), value: titleCase(filters[key]) });
  }
  if (filters.search) items.push({ label: 'Keyword', value: filters.search });
  return items;
}

export function buildReportDocumentModel({
  report,
  filters = {},
  presentation,
  generatedAt,
  generatedBy,
  role,
  villageScope,
  lookups = {}
}) {
  const orientation = presentation.orientation === 'landscape' ? 'landscape' : 'portrait';
  const paper = PAPER[presentation.paperSize] || PAPER.a4;
  const page = orientation === 'landscape'
    ? { width: paper.height, height: paper.width }
    : paper;
  const spacing = presentation.spacing === 'compact'
    ? { pageMargin: 12, sectionGap: 5, cellPadding: 1.8 }
    : presentation.spacing === 'comfortable'
      ? { pageMargin: 18, sectionGap: 8, cellPadding: 3.2 }
      : { pageMargin: 15, sectionGap: 6, cellPadding: 2.5 };
  const theme = REPORT_THEME_TOKENS[presentation.headerTheme] || REPORT_THEME_TOKENS.property_accent;
  const generatedDate = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);

  return {
    version: 1,
    page: { ...page, paperSize: presentation.paperSize, orientation, ...spacing },
    typography: {
      fontFamily: presentation.fontFamily,
      baseFontSize: Number(presentation.baseFontSize),
      brandSize: Math.max(8, Number(presentation.baseFontSize) - 1),
      titleSize: Number(presentation.baseFontSize) + 8,
      sectionSize: Number(presentation.baseFontSize) + 1,
      bodySize: Math.max(7, Number(presentation.baseFontSize) - 4),
      tableSize: Math.max(5.5, Math.min(7, Number(presentation.baseFontSize) - 4))
    },
    theme,
    brand: {
      image: '/brand/ireserve-report-header.jpg',
      alt: 'iReserve Smart Village Reservation System'
    },
    title: report.title,
    metadata: [
      { label: 'Generated At', value: Number.isNaN(generatedDate.getTime()) ? '-' : generatedDate.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }) },
      { label: 'Generated By', value: generatedBy || '-' },
      { label: 'Role', value: titleCase(role || '-') },
      { label: 'Village Scope', value: villageScope || 'All permitted villages' }
    ],
    filters: filterItems(filters, { ...lookups, villageScope }),
    summary: (report.summary || []).filter((item) => String(item.label).toLowerCase() !== 'total rows').map((item) => ({
      label: item.label,
      value: displayValue(item.value, item.type)
    })),
    columns: report.columns.map((column, index) => ({
      ...column,
      width: columnWeights(report.columns)[index]
    })),
    rows: report.rows.map((row) => report.columns.map((column) => displayValue(row[column.key], column.type, column.key))),
    footer: 'Generated by iReserve Smart Village Reservation System'
  };
}
