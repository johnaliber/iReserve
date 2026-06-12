import 'server-only';

import { normalizeRecipients } from './sendEmail';

async function getProfilesByRole(admin, roles) {
  const { data, error } = await admin
    .from('profiles')
    .select('id, full_name, email, role')
    .in('role', roles)
    .eq('status', 'active');

  if (error) {
    console.error('[email] Recipient lookup failed:', error.message);
    return [];
  }

  return data || [];
}

function uniqueProfiles(profiles) {
  const byId = new Map();
  for (const profile of profiles || []) {
    if (profile?.id && profile?.email) byId.set(profile.id, profile);
  }
  return [...byId.values()];
}

export async function getUserEmail(admin, userId) {
  if (!userId) return null;
  const { data, error } = await admin
    .from('profiles')
    .select('id, full_name, email, role, status')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[email] User recipient lookup failed:', error.message);
    return null;
  }

  if (!data || data.status === 'suspended') return null;
  const [email] = normalizeRecipients(data.email);
  return email ? { ...data, email } : null;
}

export async function getVillageAdminEmails(admin, villageId) {
  return normalizeRecipients(
    (await getVillageAdminRecipients(admin, villageId)).map((profile) => profile.email)
  );
}

export async function getVillageAdminRecipients(admin, villageId) {
  if (!villageId) return [];

  const [{ data: legacyRows }, { data: scopeRows }] = await Promise.all([
    admin.from('user_villages').select('user_id').eq('village_id', villageId).eq('role', 'village_admin'),
    admin.from('user_access_scopes').select('user_id').eq('village_id', villageId).eq('scope_type', 'village')
  ]);

  const ids = [...new Set([
    ...(legacyRows || []).map((row) => row.user_id),
    ...(scopeRows || []).map((row) => row.user_id)
  ])];
  if (!ids.length) return [];

  const { data } = await admin
    .from('profiles')
    .select('id, full_name, email, role')
    .in('id', ids)
    .eq('role', 'village_admin')
    .eq('status', 'active');

  return uniqueProfiles(data || []);
}

export async function getAccountingEmails(admin) {
  return normalizeRecipients((await getProfilesByRole(admin, ['accounting'])).map((profile) => profile.email));
}

export async function getAccountingRecipients(admin) {
  return uniqueProfiles(await getProfilesByRole(admin, ['accounting']));
}

export async function getSuperAdminEmails(admin) {
  return normalizeRecipients((await getProfilesByRole(admin, ['super_admin'])).map((profile) => profile.email));
}

export async function getSuperAdminRecipients(admin) {
  return uniqueProfiles(await getProfilesByRole(admin, ['super_admin']));
}

export async function getArchitectEmails(admin) {
  return normalizeRecipients((await getProfilesByRole(admin, ['architect'])).map((profile) => profile.email));
}

export async function getArchitectRecipients(admin, villageId = null) {
  const architects = await getProfilesByRole(admin, ['architect']);
  if (!villageId || architects.length === 0) return uniqueProfiles(architects);

  const architectIds = architects.map((profile) => profile.id);
  const [{ data: legacyRows }, { data: scopeRows }] = await Promise.all([
    admin
      .from('user_villages')
      .select('user_id')
      .in('user_id', architectIds)
      .eq('village_id', villageId)
      .eq('role', 'architect'),
    admin
      .from('user_access_scopes')
      .select('user_id')
      .in('user_id', architectIds)
      .eq('village_id', villageId)
      .eq('scope_type', 'village')
  ]);
  const assignedIds = new Set([
    ...(legacyRows || []).map((row) => row.user_id),
    ...(scopeRows || []).map((row) => row.user_id)
  ]);

  return uniqueProfiles(architects.filter((profile) => assignedIds.has(profile.id)));
}

export async function getNotificationRecipientEmails(admin, notification) {
  const user = await getUserEmail(admin, notification?.user_id || notification?.userId);
  return user ? [user.email] : [];
}
