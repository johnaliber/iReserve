import { createAdminClient } from '@/lib/supabase/admin';
import { verifyReservationFileAccessToken } from '@/lib/storage/reservationFiles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_BUCKETS = new Set(['private-documents', 'payment-proofs']);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const bucket = searchParams.get('bucket') || '';
  const path = searchParams.get('path') || '';
  const token = searchParams.get('token') || '';

  if (
    !ALLOWED_BUCKETS.has(bucket)
    || !path.startsWith('reservations/')
    || !verifyReservationFileAccessToken(bucket, path, token)
  ) {
    return Response.json({ error: 'File access is invalid.' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) {
    return Response.json({ error: 'The requested file could not be opened.' }, { status: 404 });
  }

  return Response.redirect(data.signedUrl, 307);
}
