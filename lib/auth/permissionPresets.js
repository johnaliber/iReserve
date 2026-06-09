export const PERMISSION_PRESETS = {
  super_admin: {
    label: 'Super Admin',
    description: 'Full access to every current and future system permission.',
    permissionNames: ['*']
  },
  village_admin: {
    label: 'Village Admin',
    description: 'Village operations, customers, reservations, payments, reports, and assigned audit activity.',
    permissionNames: [
      'users.view',
      'users.update',
      'users.assign_scope',
      'villages.view',
      'villages.update',
      'properties.view',
      'properties.create',
      'properties.update',
      'properties.update_status',
      'properties.manage_pricing',
      'reservations.view',
      'reservations.update',
      'reservations.approve',
      'reservations.reject',
      'reservations.cancel',
      'reservations.expire',
      'payments.view',
      'payments.verify',
      'payments.reject',
      'payments.record_manual',
      'ledger.customer_accounts.view',
      'ledger.receipts.view',
      'ledger.documents.view',
      'ledger.documents.approve',
      'ledger.documents.reject',
      'blueprints.view',
      'reports.view',
      'reports.export',
      'reports.sales',
      'reports.reservations',
      'reports.payments',
      'audit_logs.view',
      'settings.view',
      'settings.update'
    ]
  },
  accounting: {
    label: 'Accounting',
    description: 'Payments, customer ledgers, documents, refunds, and financial reporting.',
    permissionNames: [
      'payments.view',
      'payments.verify',
      'payments.reject',
      'payments.record_manual',
      'payments.refund',
      'ledger.customer_accounts.view',
      'ledger.receipts.view',
      'ledger.documents.view',
      'ledger.documents.approve',
      'ledger.documents.reject',
      'reports.view',
      'reports.export',
      'reports.sales',
      'reports.payments',
      'audit_logs.view'
    ]
  },
  architect: {
    label: 'Architect',
    description: 'Assigned village inventory and complete blueprint design workflow.',
    permissionNames: [
      'villages.view',
      'properties.view',
      'blueprints.view',
      'blueprints.create_draft',
      'blueprints.edit',
      'blueprints.publish',
      'blueprints.archive'
    ]
  },
  customer: {
    label: 'Customer',
    description: 'Own reservations, payments, and required document access.',
    permissionNames: [
      'villages.view',
      'properties.view',
      'reservations.view',
      'reservations.create',
      'payments.view',
      'ledger.documents.view'
    ]
  },
  guest: {
    label: 'Guest',
    description: 'Public browsing access before starting a reservation.',
    permissionNames: [
      'villages.view',
      'properties.view'
    ]
  }
};

export const SYSTEM_ROLE_NAMES = Object.keys(PERMISSION_PRESETS);

export function getPresetPermissionIds(permissions, presetName) {
  const preset = PERMISSION_PRESETS[presetName];
  if (!preset) return [];
  if (preset.permissionNames.includes('*')) return permissions.map((permission) => permission.id);
  const names = new Set(preset.permissionNames);
  return permissions.filter((permission) => names.has(permission.name)).map((permission) => permission.id);
}
