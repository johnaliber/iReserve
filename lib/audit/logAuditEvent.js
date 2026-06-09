import { createAdminClient } from '@/lib/supabase/admin';

function requestMetadata(request) {
  if (!request) return { ipAddress: null, userAgent: null };
  const forwarded = request.headers.get('x-forwarded-for');
  return {
    ipAddress: forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null,
    userAgent: request.headers.get('user-agent') || null
  };
}

export async function logAuditEvent({
  userId = null,
  villageId = null,
  action,
  entityType,
  entityId = null,
  description = '',
  metadata = {},
  request = null,
  admin = null
}) {
  if (!action || !entityType) return null;
  const client = admin || createAdminClient();
  const { ipAddress, userAgent } = requestMetadata(request);
  const sanitizedMetadata = JSON.parse(JSON.stringify(metadata, (key, value) => {
    if (/password|token|secret|card/i.test(key)) return '[REDACTED]';
    return value;
  }));

  const { data, error } = await client
    .from('audit_logs')
    .insert({
      user_id: userId,
      village_id: villageId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      description,
      metadata: sanitizedMetadata,
      ip_address: ipAddress,
      user_agent: userAgent
    })
    .select()
    .single();

  if (error) console.error('Audit log insert failed:', error);
  return data || null;
}
