import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { auditReportAction, prepareReportRequest } from './reportRequest';
import { buildReportDocumentModel } from './reportDocument';

const CONTENT_TYPES = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv; charset=utf-8'
};

function fileSlug(reportType) {
  return reportType.replaceAll('_', '-');
}

function displayFilters(filters, rows) {
  const first = (key, idKey, valueKey) => rows.find((row) => row[idKey] === filters[key])?.[valueKey];
  return {
    ...filters,
    ...(filters.villageId ? { villageId: first('villageId', 'villageId', 'village') || filters.villageId } : {}),
    ...(filters.propertyId ? { propertyId: first('propertyId', 'propertyId', 'propertyCode') || filters.propertyId } : {}),
    ...(filters.customerId ? { customerId: first('customerId', 'customerId', 'customer') || filters.customerId } : {}),
    ...(filters.verifiedBy ? { verifiedBy: first('verifiedBy', 'verifiedById', 'verifiedBy') || filters.verifiedBy } : {})
  };
}

export async function exportReport(request, forcedFormat = null) {
  const prepared = await prepareReportRequest(request, {
    requireExport: true,
    forcedFormat
  });
  if (prepared.error) return prepared.error;

  const {
    admin,
    user,
    profile,
    reportType,
    format,
    filters,
    presentation,
    generatedAt,
    report
  } = prepared;
  const serviceUrl = process.env.REPORT_SERVICE_URL || 'http://127.0.0.1:8787';
  const serviceSecret = process.env.REPORT_SERVICE_SECRET
    || (process.env.NODE_ENV !== 'production' ? 'ireserve-local-report-service' : '');

  if (!serviceSecret) {
    return Response.json(
      { error: 'Report generation service is not configured.' },
      { status: 503 }
    );
  }

  const villageScope = filters.villageId
    ? report.rows.find((row) => row.villageId === filters.villageId)?.village || 'Selected village'
    : profile.role === 'super_admin' ? 'All villages' : 'Assigned villages';
  const exportedFilters = displayFilters(filters, report.rows);
  exportedFilters.villageId ||= villageScope;

  let serviceResponse;
  try {
    const [brandHeaderData, watermarkData] = await Promise.all([
      readFile(path.join(process.cwd(), 'public', 'brand', 'ireserve-report-header.jpg'))
        .then((buffer) => buffer.toString('base64'))
        .catch(() => ''),
      readFile(path.join(process.cwd(), 'public', 'brand', 'ireserve-watermark.jpg'))
        .then((buffer) => buffer.toString('base64'))
        .catch(() => '')
    ]);
    const documentModel = buildReportDocumentModel({
      report,
      filters: exportedFilters,
      presentation,
      generatedAt,
      generatedBy: profile.full_name || profile.email,
      role: profile.role,
      villageScope
    });
    serviceResponse = await fetch(`${serviceUrl.replace(/\/$/, '')}/export.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Report-Service-Secret': serviceSecret
      },
      body: JSON.stringify({
        ...report,
        format,
        filters: exportedFilters,
        generatedAt,
        generatedBy: profile.full_name || profile.email,
        generatedByRole: profile.role,
        villageScope,
        brandHeaderData,
        watermarkData,
        presentation,
        documentModel
      }),
      signal: AbortSignal.timeout(60000),
      cache: 'no-store'
    });
  } catch (error) {
    console.error('Paperdoc report service request failed:', error);
    return Response.json(
      { error: 'Failed to generate report. Please try again.' },
      { status: 502 }
    );
  }

  if (!serviceResponse.ok) {
    const payload = await serviceResponse.json().catch(() => ({}));
    console.error('Paperdoc report service failed:', payload);
    return Response.json(
      { error: payload.error || 'Failed to generate report. Please try again.' },
      { status: serviceResponse.status >= 400 && serviceResponse.status < 500 ? serviceResponse.status : 502 }
    );
  }

  const bytes = await serviceResponse.arrayBuffer();
  await auditReportAction({
    request,
    admin,
    user,
    filters,
    reportType,
    format,
    rowCount: report.rows.length,
    villageId: filters.villageId
  });

  const date = generatedAt.slice(0, 10);
  const filename = `${fileSlug(reportType)}-${date}.${format}`;
  return new Response(bytes, {
    headers: {
      'Content-Type': CONTENT_TYPES[format],
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
