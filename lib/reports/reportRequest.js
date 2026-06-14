import 'server-only';

import { getUserVillageIds, hasPermission, requireApiPermission } from '@/lib/auth/rbac';
import { logAuditEvent } from '@/lib/audit/logAuditEvent';
import {
  REPORT_FORMATS,
  canRoleUseReport,
  getReportDefinition
} from './reportDefinitions';
import { getReportData } from './reportDataService';

const ALLOWED_FILTERS = new Set([
  'dateFrom', 'dateTo', 'villageId', 'propertyId', 'customerId', 'status',
  'paymentStatus', 'reservationStatus', 'paymentType', 'createdBy',
  'approvedBy', 'verifiedBy', 'sortBy', 'search'
]);

const PRESENTATION_OPTIONS = {
  fontFamily: new Set(['Arial', 'Helvetica', 'Times New Roman', 'Courier New']),
  baseFontSize: new Set(['9', '10', '11', '12']),
  paperSize: new Set(['a4', 'letter', 'legal']),
  orientation: new Set(['portrait', 'landscape']),
  spacing: new Set(['compact', 'balanced', 'comfortable']),
  headerTheme: new Set(['property_accent', 'fresh_lime', 'emerald', 'teal', 'sage', 'navy', 'slate'])
};

const DEFAULT_PRESENTATION = {
  fontFamily: 'Arial',
  baseFontSize: '11',
  paperSize: 'a4',
  orientation: 'portrait',
  spacing: 'balanced',
  headerTheme: 'property_accent'
};

function cleanFilters(filters) {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) return {};
  return Object.fromEntries(
    Object.entries(filters)
      .filter(([key]) => ALLOWED_FILTERS.has(key))
      .map(([key, value]) => [key, typeof value === 'string' ? value.trim().slice(0, 250) : value])
      .filter(([, value]) => value !== '' && value !== null && value !== undefined)
  );
}

function cleanPresentation(presentation) {
  const next = { ...DEFAULT_PRESENTATION };
  if (!presentation || typeof presentation !== 'object' || Array.isArray(presentation)) return next;
  for (const [key, allowed] of Object.entries(PRESENTATION_OPTIONS)) {
    const value = String(presentation[key] ?? '');
    if (allowed.has(value)) next[key] = value;
  }
  return next;
}

function validateDates(filters) {
  if (filters.dateFrom && Number.isNaN(Date.parse(filters.dateFrom))) return false;
  if (filters.dateTo && Number.isNaN(Date.parse(filters.dateTo))) return false;
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) return false;
  return true;
}

export async function prepareReportRequest(request, { requireExport = false, forcedFormat = null } = {}) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return { error: Response.json({ error: 'Invalid report request.' }, { status: 400 }) };
  }

  const reportType = String(payload?.reportType || '');
  const format = forcedFormat || String(payload?.format || '').toLowerCase() || null;
  const definition = getReportDefinition(reportType);

  if (!definition) {
    return { error: Response.json({ error: 'Invalid report type.' }, { status: 400 }) };
  }
  if (requireExport && !REPORT_FORMATS.includes(format)) {
    return { error: Response.json({ error: 'Invalid export format.' }, { status: 400 }) };
  }

  const context = await requireApiPermission(requireExport ? definition.exportPermission : definition.permission);
  if (context.error) return { error: context.error };
  const { admin, user, profile } = context;

  if (!canRoleUseReport(profile.role, reportType)) {
    return {
      error: Response.json(
        { error: 'You do not have permission to export this report.' },
        { status: 403 }
      )
    };
  }

  if (requireExport && definition.exportPermission !== 'reports.export') {
    const allowed = await hasPermission(admin, user.id, definition.exportPermission);
    if (!allowed) {
      return {
        error: Response.json(
          { error: 'You do not have permission to export this report.' },
          { status: 403 }
        )
      };
    }
  }

  const filters = cleanFilters(payload?.filters);
  const presentation = cleanPresentation(payload?.presentation);
  const requestedGeneratedAt = String(payload?.generatedAt || '');
  const generatedAt = requestedGeneratedAt && !Number.isNaN(Date.parse(requestedGeneratedAt))
    ? new Date(requestedGeneratedAt).toISOString()
    : new Date().toISOString();
  if (!validateDates(filters)) {
    return { error: Response.json({ error: 'Invalid date range.' }, { status: 400 }) };
  }

  let allowedVillageIds = null;
  if (profile.role !== 'super_admin') {
    allowedVillageIds = await getUserVillageIds(admin, user.id);
    if (!allowedVillageIds.length) {
      return {
        error: Response.json(
          { error: 'No assigned village scope is available for this account.' },
          { status: 403 }
        )
      };
    }
    if (filters.villageId && !allowedVillageIds.includes(filters.villageId)) {
      return {
        error: Response.json(
          { error: 'You do not have permission to export this village report.' },
          { status: 403 }
        )
      };
    }
  }

  try {
    const report = await getReportData({
      admin,
      reportType,
      filters,
      allowedVillageIds
    });

    if (!report.rows.length) {
      return {
        error: Response.json(
          { error: 'No data found for the selected filters.' },
          { status: 404 }
        )
      };
    }

    return {
      admin,
      user,
      profile,
      reportType,
      definition,
      format,
      filters,
      presentation,
      generatedAt,
      report
    };
  } catch (error) {
    console.error('Report data generation failed:', error);
    return {
      error: Response.json(
        { error: 'Failed to generate report. Please try again.' },
        { status: 500 }
      )
    };
  }
}

export async function getReportOptions() {
  const context = await requireApiPermission('reports.view');
  if (context.error) return { error: context.error };
  const { admin, user, profile } = context;
  let villageQuery = admin.from('villages').select('id, name').order('name');

  let scopedVillageIds = null;
  if (profile.role !== 'super_admin') {
    scopedVillageIds = await getUserVillageIds(admin, user.id);
    if (!scopedVillageIds.length) {
      return { context, villages: [], properties: [], customers: [], users: [] };
    }
    villageQuery = villageQuery.in('id', scopedVillageIds);
  }

  const { data: villages, error: villageError } = await villageQuery;
  if (villageError) throw villageError;
  const villageIds = (villages || []).map((village) => village.id);

  const [propertyResult, reservationResult, userResult, scopeResult] = await Promise.all([
    villageIds.length
      ? admin.from('properties').select('id, village_id, property_code').in('village_id', villageIds).order('property_code')
      : Promise.resolve({ data: [] }),
    villageIds.length
      ? admin.from('reservations').select('customer_id, profiles(full_name, email)').in('village_id', villageIds).not('customer_id', 'is', null)
      : Promise.resolve({ data: [] }),
    admin.from('profiles').select('id, full_name, email, role').in('role', ['super_admin', 'village_admin', 'accounting']).order('full_name'),
    scopedVillageIds
      ? admin.from('user_access_scopes').select('user_id, village_id').in('village_id', scopedVillageIds)
      : Promise.resolve({ data: [] })
  ]);
  const scopedUserIds = scopedVillageIds
    ? new Set((scopeResult.data || []).map((scope) => scope.user_id))
    : null;

  const customerMap = new Map();
  for (const row of reservationResult.data || []) {
    if (row.customer_id && !customerMap.has(row.customer_id)) {
      customerMap.set(row.customer_id, {
        id: row.customer_id,
        name: row.profiles?.full_name || row.profiles?.email || row.customer_id
      });
    }
  }

  return {
    context,
    villages: villages || [],
    properties: propertyResult.data || [],
    customers: [...customerMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    users: (userResult.data || []).filter((item) => !scopedUserIds || scopedUserIds.has(item.id)).map((item) => ({
      id: item.id,
      name: item.full_name || item.email,
      role: item.role
    }))
  };
}

export async function auditReportAction({
  request,
  admin,
  user,
  filters,
  reportType,
  format,
  rowCount,
  villageId
}) {
  const action = format ? `report_exported_${format}` : 'report_generated';
  await logAuditEvent({
    admin,
    request,
    userId: user.id,
    villageId: villageId || null,
    action,
    entityType: 'report',
    description: `${format ? 'Exported' : 'Generated'} ${reportType.replaceAll('_', ' ')}.`,
    metadata: {
      report_type: reportType,
      format: format || 'preview',
      filters,
      row_count: rowCount,
      generated_by: user.id
    }
  });
}
