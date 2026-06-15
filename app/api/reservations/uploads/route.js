import { createAdminClient } from '@/lib/supabase/admin';
import {
  createReservationFileAccessToken,
  safeStorageFileName,
  validateReservationFileMetadata
} from '@/lib/storage/reservationFiles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { files } = await request.json();
    if (!Array.isArray(files) || files.length === 0 || files.length > 3) {
      return Response.json({ error: 'One to three reservation files are required.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const uploads = await Promise.all(files.map(async (file) => {
      const config = validateReservationFileMetadata(file.type, file);
      const path = `reservations/${file.type}/${crypto.randomUUID()}-${safeStorageFileName(file.name)}`;
      const { data, error } = await admin.storage
        .from(config.bucket)
        .createSignedUploadUrl(path);

      if (error || !data?.token) {
        throw new Error(error?.message || `Could not prepare the ${config.label} upload.`);
      }

      return {
        type: file.type,
        bucket: config.bucket,
        path,
        uploadToken: data.token,
        accessToken: createReservationFileAccessToken(config.bucket, path)
      };
    }));

    return Response.json({ uploads });
  } catch (error) {
    console.error('Reservation upload preparation failed:', error);
    return Response.json(
      { error: error.message || 'Reservation uploads could not be prepared.' },
      { status: 400 }
    );
  }
}
