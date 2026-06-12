import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canManageVillagePayments } from '@/lib/auth/canManageVillagePayments';
import { hasPermission } from '@/lib/auth/rbac';
import { logAuditEvent } from '@/lib/audit/logAuditEvent';
import { createNotification } from '@/lib/notifications/createNotification';

export const dynamic = 'force-dynamic';

function json(status, payload) {
  return Response.json(payload, { status });
}

export async function POST(request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { documentId, status, rejectionReason } = await request.json();

  if (!documentId || !['approved', 'rejected'].includes(status)) {
    return json(400, { error: 'Document and review status are required.' });
  }

  if (status === 'rejected' && !rejectionReason?.trim()) {
    return json(400, { error: 'A rejection reason is required.' });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return json(401, { error: 'You must be signed in.' });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const requiredPermission = status === 'approved'
    ? 'ledger.documents.approve'
    : 'ledger.documents.reject';
  if (!['accounting', 'village_admin', 'super_admin'].includes(profile?.role)
    || !await hasPermission(admin, user.id, requiredPermission)) {
    return json(403, { error: 'You do not have permission to review documents.' });
  }

  const { data: document, error: documentError } = await admin
    .from('documents')
    .select('*, reservations(property_id, customer_id, properties(village_id, block_number, lot_number))')
    .eq('id', documentId)
    .single();

  if (documentError || !document) {
    return json(404, { error: 'Document was not found.' });
  }

  const villageId = document.reservations?.properties?.village_id;
  if (!await canManageVillagePayments(supabase, user.id, profile?.role, villageId)) {
    return json(403, { error: 'You do not have document access to this village.' });
  }

  const { data: updatedDocument, error: updateError } = await admin
    .from('documents')
    .update({
      status,
      rejection_reason: status === 'rejected' ? rejectionReason.trim() : null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', documentId)
    .select()
    .single();

  if (updateError) return json(400, { error: updateError.message });

  const { data: reservationDocuments } = await admin
    .from('documents')
    .select('status')
    .eq('reservation_id', document.reservation_id);

  const allApproved = (reservationDocuments || []).length > 0
    && reservationDocuments.every((item) => item.status === 'approved');

  await admin
    .from('reservations')
    .update({
      status: allApproved ? 'pending_verification' : 'pending_documents',
      updated_at: new Date().toISOString()
    })
    .eq('id', document.reservation_id)
    .in('status', ['pending_documents', 'pending_payment', 'pending_verification']);

  await logAuditEvent({
    admin,
    request,
    userId: user.id,
    villageId,
    action: status === 'approved' ? 'document_approved' : 'document_rejected',
    entityType: 'document',
    entityId: documentId,
    description: `${status === 'approved' ? 'Approved' : 'Rejected'} ${document.document_type}.`,
    metadata: status === 'rejected' ? { rejection_reason: rejectionReason.trim() } : {}
  });

  if (document.customer_id) {
    await createNotification({
      admin,
      userId: document.customer_id,
      title: status === 'approved' ? 'Document Approved' : 'Document Rejected',
      message: status === 'approved'
        ? `Your ${document.document_type} was approved.`
        : `Your ${document.document_type} was rejected. Reason: ${rejectionReason.trim()}`,
      type: status === 'approved' ? 'document_approved' : 'document_rejected',
      villageId,
      metadata: { reservationId: document.reservation_id },
      actionUrl: '/customer/documents'
    }).catch((notificationError) => {
      console.error('[notification] Document review notification failed:', notificationError.message);
    });
  }

  return json(200, { document: updatedDocument });
}
