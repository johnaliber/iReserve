import {
  auditReportAction,
  getReportOptions,
  prepareReportRequest
} from '@/lib/reports/reportRequest';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await getReportOptions();
    if (result.error) return result.error;
    return Response.json({
      role: result.context.profile.role,
      currentUser: {
        id: result.context.user.id,
        name: result.context.profile.full_name || result.context.profile.email,
        role: result.context.profile.role
      },
      villages: result.villages,
      properties: result.properties,
      customers: result.customers,
      users: result.users
    });
  } catch (error) {
    console.error('Report options failed:', error);
    return Response.json({ error: 'Report filters could not be loaded.' }, { status: 500 });
  }
}

export async function POST(request) {
  const prepared = await prepareReportRequest(request);
  if (prepared.error) return prepared.error;
  await auditReportAction({
    request,
    admin: prepared.admin,
    user: prepared.user,
    filters: prepared.filters,
    reportType: prepared.reportType,
    rowCount: prepared.report.rows.length,
    villageId: prepared.filters.villageId
  });
  return Response.json({ report: prepared.report, generatedAt: prepared.generatedAt });
}
