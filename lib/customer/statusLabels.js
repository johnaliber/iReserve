export const CUSTOMER_STATUS_LABELS = {
  pending_payment: 'Waiting for Payment',
  pending_documents: 'Documents Needed',
  pending_verification: 'Waiting for Review',
  reserved: 'Reserved',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  expired: 'Expired',
  converted_to_sale: 'Completed',
  unpaid: 'Not Paid',
  verified: 'Verified',
  refunded: 'Refunded',
  partially_paid: 'Partially Paid',
  overdue: 'Overdue',
  pending: 'Waiting for Review',
  completed: 'Completed',
  under_maintenance: 'Not Available',
  available: 'Available',
  sold: 'Sold'
};

export function friendlyStatus(status) {
  return CUSTOMER_STATUS_LABELS[status] || String(status || 'pending')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function statusTone(status) {
  if (['approved', 'reserved', 'verified', 'completed', 'converted_to_sale', 'available'].includes(status)) {
    return 'success';
  }
  if (['rejected', 'overdue', 'sold'].includes(status)) return 'danger';
  if (['cancelled', 'expired', 'refunded', 'under_maintenance'].includes(status)) return 'muted';
  return 'warning';
}
