import { createHmac, timingSafeEqual } from 'crypto';

export const RESERVATION_FILE_TYPES = {
  receipt: {
    bucket: 'payment-proofs',
    label: 'Payment Receipt',
    allowedTypes: new Set(['image/jpeg', 'image/png', 'image/webp'])
  },
  validId: {
    bucket: 'private-documents',
    label: 'Government ID',
    allowedTypes: new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
  },
  incomeProof: {
    bucket: 'private-documents',
    label: 'Proof of Income',
    allowedTypes: new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
  }
};

export const MAX_RESERVATION_FILE_BYTES = 10 * 1024 * 1024;

function storageSecret() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for reservation file access.');
  }
  return secret;
}

function capabilityPayload(bucket, path) {
  return `${bucket}\n${path}`;
}

export function createReservationFileAccessToken(bucket, path) {
  return createHmac('sha256', storageSecret())
    .update(capabilityPayload(bucket, path))
    .digest('base64url');
}

export function verifyReservationFileAccessToken(bucket, path, token) {
  if (!bucket || !path || !token) return false;

  const expected = Buffer.from(createReservationFileAccessToken(bucket, path));
  const received = Buffer.from(String(token));
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function reservationFileUrl(bucket, path, token) {
  const params = new URLSearchParams({ bucket, path, token });
  return `/api/storage/reservation-file?${params.toString()}`;
}

export function safeStorageFileName(value, fallback = 'upload') {
  const normalized = String(value || fallback)
    .normalize('NFKD')
    .replace(/[^\w.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(-100);

  return normalized || fallback;
}

export function validateReservationFileMetadata(type, file) {
  const config = RESERVATION_FILE_TYPES[type];
  if (!config) throw new Error('Unsupported reservation file type.');

  const size = Number(file?.size);
  const contentType = String(file?.contentType || '').toLowerCase();
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error(`${config.label} is empty.`);
  }
  if (size > MAX_RESERVATION_FILE_BYTES) {
    throw new Error(`${config.label} must be 10MB or smaller.`);
  }
  if (!config.allowedTypes.has(contentType)) {
    throw new Error(`${config.label} has an unsupported file type.`);
  }

  return config;
}

export function validateReservationFileReference(type, reference) {
  const config = RESERVATION_FILE_TYPES[type];
  const bucket = String(reference?.bucket || '');
  const path = String(reference?.path || '');
  const accessToken = String(reference?.accessToken || '');

  if (!config || bucket !== config.bucket || !path.startsWith(`reservations/${type}/`)) {
    throw new Error(`Invalid ${config?.label || 'reservation file'} reference.`);
  }
  if (!verifyReservationFileAccessToken(bucket, path, accessToken)) {
    throw new Error(`Invalid ${config.label} access token.`);
  }

  return { bucket, path, accessToken };
}
