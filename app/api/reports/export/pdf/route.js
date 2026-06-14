import { exportReport } from '@/lib/reports/exportReport';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  return exportReport(request, 'pdf');
}

