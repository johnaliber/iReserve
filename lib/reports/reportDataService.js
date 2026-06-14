import 'server-only';

import { getReportDefinition } from './reportDefinitions';

const MAX_REPORT_ROWS = 5000;

function text(value, fallback = '-') {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

function number(value) {
  return Number(value || 0);
}

function person(profile, fallback = '-') {
  return profile?.full_name || profile?.email || fallback;
}

function propertyCode(property) {
  return property?.property_code || property?.propertyCode || '-';
}

function villageName(village) {
  return village?.name || '-';
}

function withinScope(row, villageIds) {
  return !villageIds || villageIds.includes(row.villageId);
}

function filterRows(rows, filters = {}) {
  const search = String(filters.search || '').trim().toLowerCase();
  const from = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
  const to = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59.999`) : null;

  let filtered = rows.filter((row) => {
    const rowDate = row.date ? new Date(row.date) : null;
    if (filters.villageId && row.villageId !== filters.villageId) return false;
    if (filters.propertyId && row.propertyId !== filters.propertyId) return false;
    if (filters.customerId && row.customerId !== filters.customerId) return false;
    if (filters.status && row.status !== filters.status) return false;
    if (filters.paymentStatus && row.paymentStatus !== filters.paymentStatus) return false;
    if (filters.reservationStatus && row.reservationStatus !== filters.reservationStatus) return false;
    if (filters.paymentType && row.paymentType !== filters.paymentType) return false;
    if (filters.createdBy && row.createdBy !== filters.createdBy) return false;
    if (filters.approvedBy && row.approvedBy !== filters.approvedBy) return false;
    if (filters.verifiedBy && row.verifiedById !== filters.verifiedBy) return false;
    if (from && rowDate && rowDate < from) return false;
    if (to && rowDate && rowDate > to) return false;
    if (search && !Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(search))) return false;
    return true;
  });

  const sort = filters.sortBy || 'newest';
  filtered = [...filtered].sort((a, b) => {
    if (sort === 'oldest') return new Date(a.date || 0) - new Date(b.date || 0);
    if (sort === 'highest_amount') return number(b.amount ?? b.amountPaid ?? b.price) - number(a.amount ?? a.amountPaid ?? a.price);
    if (sort === 'lowest_amount') return number(a.amount ?? a.amountPaid ?? a.price) - number(b.amount ?? b.amountPaid ?? b.price);
    if (sort === 'a_z') return text(a.customer ?? a.village ?? a.propertyCode).localeCompare(text(b.customer ?? b.village ?? b.propertyCode));
    if (sort === 'z_a') return text(b.customer ?? b.village ?? b.propertyCode).localeCompare(text(a.customer ?? a.village ?? a.propertyCode));
    return new Date(b.date || 0) - new Date(a.date || 0);
  });

  return filtered.slice(0, MAX_REPORT_ROWS);
}

async function query(admin, table, select) {
  const { data, error } = await admin.from(table).select(select).limit(MAX_REPORT_ROWS);
  if (error) throw error;
  return data || [];
}

async function salesRows(admin) {
  const rows = await query(admin, 'payment_plans',
    '*, reservations(reservation_code, status, reserved_at, profiles(full_name, email), properties(id, property_code, villages(id, name))), profiles(full_name, email)');
  return rows.map((plan) => ({
    date: plan.last_payment_date || plan.created_at,
    villageId: plan.village_id,
    propertyId: plan.property_id,
    customerId: plan.customer_id,
    village: villageName(plan.reservations?.properties?.villages),
    propertyCode: propertyCode(plan.reservations?.properties),
    customer: person(plan.profiles || plan.reservations?.profiles),
    paymentType: plan.payment_type,
    amountPaid: number(plan.amount_paid),
    remainingBalance: number(plan.remaining_balance),
    status: plan.status,
    paymentStatus: plan.status,
    reservationStatus: plan.reservations?.status,
    verifiedBy: '-'
  }));
}

async function reservationRows(admin) {
  const rows = await query(admin, 'reservations',
    '*, profiles(full_name, email), properties(id, property_code, villages(id, name))');
  return rows.map((reservation) => ({
    date: reservation.reserved_at || reservation.created_at,
    villageId: reservation.village_id,
    propertyId: reservation.property_id,
    customerId: reservation.customer_id,
    reservationId: reservation.reservation_code || reservation.id,
    customer: person(reservation.profiles, reservation.guest_name || reservation.guest_email || 'Guest'),
    email: reservation.profiles?.email || reservation.guest_email || '-',
    phone: reservation.guest_phone || '-',
    village: villageName(reservation.properties?.villages),
    propertyCode: propertyCode(reservation.properties),
    status: reservation.status,
    reservationStatus: reservation.status,
    paymentType: reservation.payment_type,
    amountDue: number(reservation.amount_due_today || reservation.initial_amount_due || reservation.reservation_fee),
    amountPaid: number(reservation.amount_paid)
  }));
}

async function paymentRows(admin) {
  const rows = await query(admin, 'payments',
    '*, customer:profiles!payments_customer_id_fkey(full_name, email), verifier:profiles!payments_verified_by_fkey(full_name, email), reservations(reservation_code, status, payment_type, properties(id, property_code, villages(id, name)))');
  return rows.map((payment) => ({
    date: payment.created_at,
    villageId: payment.village_id,
    propertyId: payment.reservations?.properties?.id,
    customerId: payment.customer_id,
    paymentId: payment.id,
    customer: person(payment.customer),
    village: villageName(payment.reservations?.properties?.villages),
    propertyCode: propertyCode(payment.reservations?.properties),
    purpose: payment.payment_purpose,
    method: payment.payment_method,
    amount: number(payment.accepted_amount || payment.amount),
    referenceNumber: payment.reference_number || '-',
    receiptNumber: payment.official_receipt_number || '-',
    status: payment.payment_status,
    paymentStatus: payment.payment_status,
    reservationStatus: payment.reservations?.status,
    paymentType: payment.reservations?.payment_type,
    verifiedDate: payment.verified_at,
    verifiedBy: person(payment.verifier),
    verifiedById: payment.verified_by,
    reservationInfo: payment.reservations?.reservation_code || '-'
  }));
}

async function propertyRows(admin) {
  const rows = await query(admin, 'properties', '*, villages(id, name)');
  return rows.map((property) => ({
    date: property.created_at,
    villageId: property.village_id,
    propertyId: property.id,
    village: villageName(property.villages),
    phase: text(property.phase_number),
    block: text(property.block_number),
    lot: text(property.lot_number),
    propertyCode: property.property_code,
    propertyType: property.property_type,
    price: number(property.price),
    status: property.status,
    floodRisk: property.flood_risk,
    sunlightExposure: property.sunlight_exposure
  }));
}

async function customerRows(admin) {
  const rows = await reservationRows(admin);
  return rows;
}

async function villageRows(admin) {
  const [villages, properties, reservations, payments] = await Promise.all([
    query(admin, 'villages', '*'),
    query(admin, 'properties', 'id, village_id, status'),
    query(admin, 'reservations', 'id, village_id'),
    query(admin, 'payments', 'village_id, amount, accepted_amount, payment_status')
  ]);
  return villages.map((village) => {
    const villageProperties = properties.filter((row) => row.village_id === village.id);
    return {
      date: village.created_at,
      villageId: village.id,
      village: village.name,
      totalProperties: villageProperties.length,
      availableProperties: villageProperties.filter((row) => row.status === 'available').length,
      reservedProperties: villageProperties.filter((row) => row.status === 'reserved').length,
      soldProperties: villageProperties.filter((row) => row.status === 'sold').length,
      reservations: reservations.filter((row) => row.village_id === village.id).length,
      verifiedRevenue: payments
        .filter((row) => row.village_id === village.id && row.payment_status === 'verified')
        .reduce((sum, row) => sum + number(row.accepted_amount || row.amount), 0)
    };
  });
}

async function blueprintRows(admin) {
  const [blueprints, objects] = await Promise.all([
    query(admin, 'blueprints', '*, villages(id, name)'),
    query(admin, 'blueprint_objects', 'id, blueprint_id')
  ]);
  return blueprints.map((blueprint) => ({
    date: blueprint.updated_at,
    villageId: blueprint.village_id,
    createdBy: blueprint.created_by,
    village: villageName(blueprint.villages),
    blueprint: blueprint.name,
    version: blueprint.version,
    status: blueprint.status,
    objects: objects.filter((object) => object.blueprint_id === blueprint.id).length,
    publishedAt: blueprint.published_at
  }));
}

async function siteViewingRows(admin) {
  const rows = await query(admin, 'site_viewings',
    '*, profiles(full_name, email), properties(id, property_code, villages(id, name))');
  return rows.map((viewing) => ({
    date: viewing.created_at,
    viewingDate: viewing.preferred_date,
    viewingTime: viewing.preferred_time,
    villageId: viewing.village_id,
    propertyId: viewing.property_id,
    customerId: viewing.customer_id,
    customer: person(viewing.profiles, viewing.guest_name || viewing.guest_email || 'Guest'),
    village: villageName(viewing.properties?.villages),
    propertyCode: propertyCode(viewing.properties),
    status: viewing.status,
    notes: viewing.notes || '-'
  }));
}

async function refundRows(admin) {
  const rows = await query(admin, 'refunds',
    '*, processor:profiles!refunds_processed_by_fkey(full_name, email), payments(customer_id, village_id, reservations(properties(id, property_code, villages(id, name)), profiles(full_name, email))');
  return rows.map((refund) => ({
    date: refund.created_at,
    villageId: refund.payments?.village_id,
    propertyId: refund.payments?.reservations?.properties?.id,
    customerId: refund.payments?.customer_id,
    customer: person(refund.payments?.reservations?.profiles),
    village: villageName(refund.payments?.reservations?.properties?.villages),
    propertyCode: propertyCode(refund.payments?.reservations?.properties),
    amount: number(refund.amount),
    reason: refund.reason,
    status: refund.status,
    processedBy: person(refund.processor),
    processedAt: refund.processed_at,
    approvedBy: refund.processed_by
  }));
}

async function auditRows(admin) {
  const rows = await query(admin, 'audit_logs',
    '*, profiles:user_id(full_name, email, role), villages(id, name)');
  return rows.map((log) => ({
    date: log.created_at,
    villageId: log.village_id,
    user: person(log.profiles, 'System'),
    role: log.profiles?.role || 'system',
    action: log.action,
    entityType: log.entity_type,
    village: villageName(log.villages),
    description: log.description || '-',
    ipAddress: log.ip_address || '-',
    createdBy: log.user_id
  }));
}

async function inquiryRows(admin) {
  const rows = await query(admin, 'inquiries',
    '*, villages(id, name), properties(id, property_code)');
  return rows.map((inquiry) => ({
    date: inquiry.created_at,
    villageId: inquiry.village_id,
    propertyId: inquiry.property_id,
    customerId: inquiry.customer_id,
    customer: inquiry.name,
    email: inquiry.email,
    phone: inquiry.phone || '-',
    village: villageName(inquiry.villages),
    propertyCode: propertyCode(inquiry.properties),
    paymentType: inquiry.payment_type,
    budget: number(inquiry.estimated_budget),
    status: inquiry.status || inquiry.inquiry_status,
    message: inquiry.message
  }));
}

async function ledgerRows(admin) {
  const rows = await query(admin, 'payment_plans',
    '*, profiles(full_name, email), properties(id, property_code, villages(id, name))');
  return rows.map((plan) => ({
    date: plan.created_at,
    villageId: plan.village_id,
    propertyId: plan.property_id,
    customerId: plan.customer_id,
    customer: person(plan.profiles),
    email: plan.profiles?.email || '-',
    village: villageName(plan.properties?.villages),
    propertyCode: propertyCode(plan.properties),
    paymentType: plan.payment_type,
    totalContractPrice: number(plan.total_contract_price),
    amountPaid: number(plan.amount_paid),
    remainingBalance: number(plan.remaining_balance),
    monthlyPayment: number(plan.monthly_payment),
    nextDueDate: plan.next_due_date,
    status: plan.status,
    paymentStatus: plan.status
  }));
}

async function documentRows(admin) {
  const rows = await query(admin, 'documents',
    '*, reviewer:profiles!documents_reviewed_by_fkey(full_name, email), reservations(village_id, property_id, profiles(full_name, email), properties(id, property_code, villages(id, name)))');
  return rows.map((document) => ({
    date: document.uploaded_at,
    villageId: document.reservations?.village_id,
    propertyId: document.reservations?.property_id,
    customerId: document.customer_id,
    customer: person(document.reservations?.profiles),
    documentType: document.document_type,
    village: villageName(document.reservations?.properties?.villages),
    propertyCode: propertyCode(document.reservations?.properties),
    status: document.status,
    reviewedBy: person(document.reviewer),
    reviewedDate: document.reviewed_at,
    rejectionReason: document.rejection_reason || '-',
    approvedBy: document.reviewed_by
  }));
}

async function installmentRows(admin) {
  const rows = await query(admin, 'payment_schedule',
    '*, payment_plans(village_id, property_id, customer_id, profiles(full_name, email), properties(id, property_code, villages(id, name)))');
  return rows.map((schedule) => ({
    date: schedule.due_date,
    villageId: schedule.payment_plans?.village_id,
    propertyId: schedule.payment_plans?.property_id,
    customerId: schedule.payment_plans?.customer_id,
    customer: person(schedule.payment_plans?.profiles),
    village: villageName(schedule.payment_plans?.properties?.villages),
    propertyCode: propertyCode(schedule.payment_plans?.properties),
    dueNumber: schedule.due_number,
    amountDue: number(schedule.amount_due),
    amountPaid: number(schedule.amount_paid),
    remainingDue: number(schedule.remaining_due),
    status: schedule.status,
    paymentStatus: schedule.status
  }));
}

async function trendRows(admin) {
  const [reservations, payments, villages] = await Promise.all([
    query(admin, 'reservations', 'id, village_id, status, reserved_at, created_at'),
    query(admin, 'payments', 'id, village_id, payment_status, amount, accepted_amount, verified_at, created_at'),
    query(admin, 'villages', 'id, name')
  ]);
  const villageNames = new Map(villages.map((village) => [village.id, village.name]));
  const periods = new Map();

  const getPeriod = (dateValue, villageId) => {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return null;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const scopedKey = `${villageId || 'all'}:${key}`;
    if (!periods.has(scopedKey)) {
      periods.set(scopedKey, {
        date: `${key}-01`,
        period: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        villageId,
        village: villageNames.get(villageId) || '-',
        reservations: 0,
        approvedReservations: 0,
        verifiedPayments: 0,
        revenue: 0,
        averagePayment: 0
      });
    }
    return periods.get(scopedKey);
  };

  for (const reservation of reservations) {
    const period = getPeriod(reservation.reserved_at || reservation.created_at, reservation.village_id);
    if (!period) continue;
    period.reservations += 1;
    if (['approved', 'converted_to_sale'].includes(reservation.status)) period.approvedReservations += 1;
  }
  for (const payment of payments) {
    if (payment.payment_status !== 'verified') continue;
    const period = getPeriod(payment.verified_at || payment.created_at, payment.village_id);
    if (!period) continue;
    period.verifiedPayments += 1;
    period.revenue += number(payment.accepted_amount || payment.amount);
  }
  for (const period of periods.values()) {
    period.averagePayment = period.verifiedPayments ? period.revenue / period.verifiedPayments : 0;
  }
  return [...periods.values()];
}

const loaders = {
  sales: salesRows,
  reservations: reservationRows,
  payments: paymentRows,
  customers: customerRows,
  properties: propertyRows,
  villages: villageRows,
  blueprints: blueprintRows,
  siteViewings: siteViewingRows,
  refunds: refundRows,
  audit: auditRows,
  activity: auditRows,
  inquiries: inquiryRows,
  ledger: ledgerRows,
  receipts: paymentRows,
  documents: documentRows,
  installments: installmentRows,
  trends: trendRows
};

function buildSummary(rows, definition) {
  const sum = (key) => rows.reduce((total, row) => total + number(row[key]), 0);
  const countStatus = (status) => rows.filter((row) => row.status === status).length;
  if (definition.category === 'sales') {
    return [
      { label: 'Total sales', value: sum('amountPaid'), type: 'currency' },
      { label: 'Total remaining balance', value: sum('remainingBalance'), type: 'currency' },
      { label: 'Active accounts', value: rows.filter((row) => !['fully_paid', 'cancelled'].includes(row.status)).length, type: 'number' }
    ];
  }
  if (definition.category === 'reservations') {
    return [
      { label: 'Approved', value: countStatus('approved'), type: 'number' },
      { label: 'Cancelled', value: countStatus('cancelled'), type: 'number' },
      { label: 'Expired', value: countStatus('expired'), type: 'number' }
    ];
  }
  if (['payments', 'receipts'].includes(definition.category)) {
    return [
      { label: 'Total amount', value: sum('amount'), type: 'currency' },
      { label: 'Verified', value: countStatus('verified'), type: 'number' },
      { label: 'Pending', value: countStatus('pending_verification'), type: 'number' },
      { label: 'Rejected', value: countStatus('rejected'), type: 'number' }
    ];
  }
  if (definition.category === 'ledger') {
    return [
      { label: 'Contract value', value: sum('totalContractPrice'), type: 'currency' },
      { label: 'Amount paid', value: sum('amountPaid'), type: 'currency' },
      { label: 'Remaining balance', value: sum('remainingBalance'), type: 'currency' },
      { label: 'Overdue accounts', value: countStatus('overdue'), type: 'number' }
    ];
  }
  if (definition.category === 'installments') {
    return [
      { label: 'Amount due', value: sum('amountDue'), type: 'currency' },
      { label: 'Amount paid', value: sum('amountPaid'), type: 'currency' },
      { label: 'Remaining due', value: sum('remainingDue'), type: 'currency' },
      { label: 'Overdue', value: countStatus('overdue'), type: 'number' }
    ];
  }
  if (definition.category === 'trends') {
    return [
      { label: 'Reservations', value: sum('reservations'), type: 'number' },
      { label: 'Approved', value: sum('approvedReservations'), type: 'number' },
      { label: 'Verified revenue', value: sum('revenue'), type: 'currency' },
      { label: 'Verified payments', value: sum('verifiedPayments'), type: 'number' }
    ];
  }
  return [];
}

export async function getReportData({ admin, reportType, filters, allowedVillageIds }) {
  const definition = getReportDefinition(reportType);
  if (!definition) throw new Error('Invalid report type.');

  let rows = await loaders[definition.category](admin);
  rows = rows.filter((row) => withinScope(row, allowedVillageIds));

  if (reportType === 'overdue_payment_report') {
    rows = rows.filter((row) => row.status === 'overdue');
  }

  rows = filterRows(rows, filters);
  return {
    reportType,
    title: definition.title,
    subtitle: definition.subtitle,
    columns: definition.columns.map(([key, label, type = 'text']) => ({ key, label, type })),
    rows,
    summary: buildSummary(rows, definition)
  };
}
