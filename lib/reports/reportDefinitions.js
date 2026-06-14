export const REPORT_FORMATS = ['pdf', 'xlsx', 'csv'];

const roles = {
  admin: ['super_admin'],
  village: ['super_admin', 'village_admin'],
  accounting: ['super_admin', 'accounting']
};

const columns = {
  sales: [
    ['date', 'Date', 'date'],
    ['village', 'Village'],
    ['propertyCode', 'Property Code'],
    ['customer', 'Customer'],
    ['paymentType', 'Payment Type'],
    ['amountPaid', 'Amount Paid', 'currency'],
    ['remainingBalance', 'Remaining Balance', 'currency'],
    ['status', 'Payment Status'],
    ['verifiedBy', 'Verified By']
  ],
  reservations: [
    ['reservationId', 'Reservation ID'],
    ['customer', 'Customer'],
    ['village', 'Village'],
    ['propertyCode', 'Property Code'],
    ['date', 'Reservation Date', 'date'],
    ['status', 'Reservation Status'],
    ['paymentType', 'Payment Type'],
    ['amountDue', 'Amount Due', 'currency'],
    ['amountPaid', 'Amount Paid', 'currency']
  ],
  payments: [
    ['paymentId', 'Payment ID'],
    ['customer', 'Customer'],
    ['village', 'Village'],
    ['propertyCode', 'Property Code'],
    ['purpose', 'Payment Purpose'],
    ['method', 'Payment Method'],
    ['amount', 'Amount', 'currency'],
    ['referenceNumber', 'Reference Number'],
    ['status', 'Status'],
    ['date', 'Uploaded Date', 'date'],
    ['verifiedDate', 'Verified Date', 'date'],
    ['verifiedBy', 'Verified By']
  ],
  customers: [
    ['customer', 'Customer'],
    ['email', 'Email'],
    ['phone', 'Phone'],
    ['village', 'Village'],
    ['propertyCode', 'Property'],
    ['reservationStatus', 'Reservation Status'],
    ['date', 'Created Date', 'date']
  ],
  properties: [
    ['village', 'Village'],
    ['phase', 'Phase'],
    ['block', 'Block'],
    ['lot', 'Lot'],
    ['propertyCode', 'Property Code'],
    ['propertyType', 'Property Type'],
    ['price', 'Price', 'currency'],
    ['status', 'Status'],
    ['floodRisk', 'Flood Risk'],
    ['sunlightExposure', 'Sunlight Exposure']
  ],
  villages: [
    ['village', 'Village'],
    ['totalProperties', 'Total Properties', 'number'],
    ['availableProperties', 'Available', 'number'],
    ['reservedProperties', 'Reserved', 'number'],
    ['soldProperties', 'Sold', 'number'],
    ['reservations', 'Reservations', 'number'],
    ['verifiedRevenue', 'Verified Revenue', 'currency']
  ],
  blueprints: [
    ['village', 'Village'],
    ['blueprint', 'Blueprint'],
    ['version', 'Version', 'number'],
    ['status', 'Status'],
    ['objects', 'Objects', 'number'],
    ['date', 'Updated Date', 'date'],
    ['publishedAt', 'Published Date', 'date']
  ],
  siteViewings: [
    ['date', 'Requested Date', 'date'],
    ['viewingDate', 'Viewing Date', 'date'],
    ['viewingTime', 'Viewing Time'],
    ['customer', 'Customer'],
    ['village', 'Village'],
    ['propertyCode', 'Property Code'],
    ['status', 'Status'],
    ['notes', 'Notes']
  ],
  refunds: [
    ['date', 'Requested Date', 'date'],
    ['customer', 'Customer'],
    ['village', 'Village'],
    ['propertyCode', 'Property Code'],
    ['amount', 'Amount', 'currency'],
    ['reason', 'Reason'],
    ['status', 'Status'],
    ['processedBy', 'Processed By'],
    ['processedAt', 'Processed Date', 'date']
  ],
  audit: [
    ['date', 'Date & Time', 'datetime'],
    ['user', 'User'],
    ['role', 'Role'],
    ['action', 'Action'],
    ['entityType', 'Entity Type'],
    ['village', 'Village'],
    ['description', 'Description'],
    ['ipAddress', 'IP Address']
  ],
  activity: [
    ['date', 'Date & Time', 'datetime'],
    ['user', 'User'],
    ['role', 'Role'],
    ['action', 'Activity'],
    ['entityType', 'Area'],
    ['village', 'Village'],
    ['description', 'Description']
  ],
  inquiries: [
    ['date', 'Date', 'date'],
    ['customer', 'Customer'],
    ['email', 'Email'],
    ['phone', 'Phone'],
    ['village', 'Village'],
    ['propertyCode', 'Property Code'],
    ['paymentType', 'Payment Type'],
    ['budget', 'Estimated Budget', 'currency'],
    ['status', 'Status'],
    ['message', 'Message']
  ],
  ledger: [
    ['customer', 'Customer'],
    ['email', 'Email'],
    ['propertyCode', 'Property'],
    ['paymentType', 'Payment Type'],
    ['totalContractPrice', 'Total Contract Price', 'currency'],
    ['amountPaid', 'Amount Paid', 'currency'],
    ['remainingBalance', 'Remaining Balance', 'currency'],
    ['monthlyPayment', 'Monthly Payment', 'currency'],
    ['nextDueDate', 'Next Due Date', 'date'],
    ['status', 'Overdue Status']
  ],
  receipts: [
    ['receiptNumber', 'Receipt Number'],
    ['reservationInfo', 'Reservation Info'],
    ['customer', 'Customer'],
    ['village', 'Village'],
    ['propertyCode', 'Property'],
    ['amount', 'Deposit Fee', 'currency'],
    ['method', 'Transfer Method'],
    ['referenceNumber', 'Reference ID'],
    ['status', 'Status'],
    ['verifiedBy', 'Verified By'],
    ['verifiedDate', 'Verified At', 'datetime']
  ],
  documents: [
    ['customer', 'Customer'],
    ['documentType', 'Document Type'],
    ['village', 'Village'],
    ['propertyCode', 'Property'],
    ['date', 'Uploaded Date', 'date'],
    ['status', 'Status'],
    ['reviewedBy', 'Reviewed By'],
    ['reviewedDate', 'Reviewed Date', 'date'],
    ['rejectionReason', 'Rejection Reason']
  ],
  installments: [
    ['customer', 'Customer'],
    ['village', 'Village'],
    ['propertyCode', 'Property'],
    ['dueNumber', 'Due Number', 'number'],
    ['date', 'Due Date', 'date'],
    ['amountDue', 'Amount Due', 'currency'],
    ['amountPaid', 'Amount Paid', 'currency'],
    ['remainingDue', 'Remaining Due', 'currency'],
    ['status', 'Status']
  ],
  trends: [
    ['period', 'Period'],
    ['village', 'Village'],
    ['reservations', 'Reservations', 'number'],
    ['approvedReservations', 'Approved', 'number'],
    ['verifiedPayments', 'Verified Payments', 'number'],
    ['revenue', 'Collected Revenue', 'currency'],
    ['averagePayment', 'Average Payment', 'currency']
  ]
};

function definition(title, category, allowedRoles, options = {}) {
  return {
    title,
    subtitle: options.subtitle || `${title} generated from current iReserve records.`,
    category,
    allowedRoles,
    permission: options.permission || 'reports.view',
    exportPermission: options.exportPermission || 'reports.export',
    columns: columns[category],
    statuses: options.statuses || [],
    paymentRelated: Boolean(options.paymentRelated)
  };
}

export const REPORT_DEFINITIONS = {
  sales_report: definition('Sales Report', 'sales', roles.admin, { paymentRelated: true }),
  reservation_report: definition('Reservation Report', 'reservations', roles.admin, {
    statuses: ['pending_payment', 'pending_documents', 'pending_verification', 'reserved', 'approved', 'rejected', 'cancelled', 'expired', 'converted_to_sale']
  }),
  payment_report: definition('Payment Report', 'payments', roles.admin, {
    statuses: ['unpaid', 'pending_verification', 'verified', 'rejected', 'partially_paid', 'overdue', 'refunded'],
    paymentRelated: true
  }),
  customer_report: definition('Customer Report', 'customers', roles.admin),
  property_status_report: definition('Property / Lot Status Report', 'properties', roles.admin, {
    statuses: ['available', 'reserved', 'sold', 'under_maintenance', 'hidden']
  }),
  village_performance_report: definition('Village Performance Report', 'villages', roles.village, {
    subtitle: 'Community inventory, reservations, sold lots, availability, and verified revenue.'
  }),
  blueprint_report: definition('Blueprint Report', 'blueprints', roles.admin, {
    statuses: ['draft', 'published', 'archived']
  }),
  site_viewing_report: definition('Site Viewing Report', 'siteViewings', roles.village, {
    statuses: ['pending', 'approved', 'rejected', 'completed', 'cancelled']
  }),
  refund_report: definition('Refund Report', 'refunds', ['super_admin', 'accounting'], {
    statuses: ['requested', 'approved', 'rejected', 'processed'],
    paymentRelated: true
  }),
  audit_logs_report: definition('Audit Logs Report', 'audit', roles.admin, {
    permission: 'audit_logs.view',
    exportPermission: 'audit_logs.export'
  }),
  user_activity_report: definition('User Activity Report', 'activity', roles.admin, {
    permission: 'audit_logs.view',
    exportPermission: 'audit_logs.export'
  }),

  village_sales_report: definition('Village Sales Report', 'sales', roles.village, { paymentRelated: true }),
  village_reservation_report: definition('Village Reservation Report', 'reservations', roles.village, {
    statuses: ['pending_payment', 'pending_documents', 'pending_verification', 'reserved', 'approved', 'rejected', 'cancelled', 'expired', 'converted_to_sale']
  }),
  property_availability_report: definition('Property Availability Report', 'properties', roles.village, {
    statuses: ['available', 'reserved', 'sold', 'under_maintenance', 'hidden']
  }),
  customer_inquiry_report: definition('Customer Inquiry Report', 'inquiries', roles.village, {
    statuses: ['new', 'in_progress', 'resolved', 'closed']
  }),
  payment_summary_report: definition('Payment Summary Report', 'payments', roles.village, {
    statuses: ['unpaid', 'pending_verification', 'verified', 'rejected', 'partially_paid', 'overdue', 'refunded'],
    paymentRelated: true
  }),
  blueprint_preview_report: definition('Blueprint Preview Report', 'blueprints', roles.village, {
    statuses: ['draft', 'published', 'archived']
  }),

  customer_account_ledger: definition('Customer Account Ledger', 'ledger', roles.accounting, {
    statuses: ['pending_initial_payment', 'active', 'downpayment_completed', 'fully_paid', 'overdue', 'cancelled', 'defaulted'],
    paymentRelated: true
  }),
  receipts_audit_ledger: definition('Receipts Audit Ledger', 'receipts', roles.accounting, {
    statuses: ['unpaid', 'pending_verification', 'verified', 'rejected', 'partially_paid', 'overdue', 'refunded'],
    paymentRelated: true
  }),
  customer_documents_report: definition('Customer Documents Report', 'documents', roles.accounting, {
    statuses: ['pending', 'approved', 'rejected'],
    paymentRelated: true
  }),
  payment_verification_report: definition('Payment Verification Report', 'payments', roles.accounting, {
    statuses: ['pending_verification', 'verified', 'rejected'],
    paymentRelated: true
  }),
  installment_due_report: definition('Installment Due Report', 'installments', roles.accounting, {
    statuses: ['unpaid', 'partially_paid', 'paid', 'overdue', 'waived', 'cancelled'],
    paymentRelated: true
  }),
  overdue_payment_report: definition('Overdue Payment Report', 'installments', roles.accounting, {
    statuses: ['overdue'],
    paymentRelated: true
  }),
  statement_of_account: definition('Statement of Account', 'ledger', roles.accounting, {
    paymentRelated: true
  }),

  property_report: definition('Property Report', 'properties', roles.village, {
    subtitle: 'Inventory, pricing, property classification, availability, and site exposure.',
    statuses: ['available', 'reserved', 'sold', 'under_maintenance', 'hidden']
  }),
  financial_management_report: definition('Financial and Management Report', 'ledger', ['super_admin', 'accounting'], {
    subtitle: 'Contract values, collections, balances, payment plans, and account standing.',
    statuses: ['pending_initial_payment', 'active', 'downpayment_completed', 'fully_paid', 'overdue', 'cancelled', 'defaulted'],
    paymentRelated: true
  }),
  trends_report: definition('Trends Report', 'trends', ['super_admin', 'village_admin', 'accounting'], {
    subtitle: 'Monthly reservation activity, verified collections, revenue, and payment averages.',
    paymentRelated: true
  }),
  customer_payment_report: definition('Customer Payment Report', 'payments', ['super_admin', 'village_admin', 'accounting'], {
    subtitle: 'Customer payment history, methods, references, verification status, and amounts.',
    statuses: ['unpaid', 'pending_verification', 'verified', 'rejected', 'partially_paid', 'overdue', 'refunded'],
    paymentRelated: true
  })
};

export const REPORT_CATALOGS = {
  super_admin: [
    'village_performance_report',
    'property_report',
    'financial_management_report',
    'trends_report',
    'customer_payment_report',
    'audit_logs_report'
  ],
  village_admin: [
    'village_performance_report',
    'property_report',
    'trends_report',
    'customer_payment_report'
  ],
  accounting: [
    'financial_management_report',
    'trends_report',
    'customer_payment_report'
  ]
};

export function getReportDefinition(reportType) {
  return REPORT_DEFINITIONS[reportType] || null;
}

export function canRoleUseReport(role, reportType) {
  return Boolean(REPORT_DEFINITIONS[reportType]?.allowedRoles.includes(role));
}
