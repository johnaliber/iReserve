'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardShell from '@/components/layout/DashboardShell';
import AdminPageHeader from './AdminPageHeader';
import AdminSectionCard from './AdminSectionCard';
import AdminStatusBadge from './AdminStatusBadge';
import UserRoleSelector from './UserRoleSelector';
import UserAccessScopeManager from './UserAccessScopeManager';
import PermissionMatrix from './PermissionMatrix';
import UserActivityPanel from './UserActivityPanel';
import { getPresetPermissionIds, PERMISSION_PRESETS } from '@/lib/auth/permissionPresets';
import { Sparkles } from 'lucide-react';

export default function UserDetailPage({ userId, backHref = '/super-admin/users', limitedMode = false }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(searchParams.get('tab') || 'profile');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/users/${userId}`);
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error);
      return;
    }
    setData(payload);
    setForm({
      full_name: payload.profile.full_name,
      phone: payload.profile.phone || '',
      role: payload.profile.role,
      status: payload.profile.status,
      suspension_reason: payload.profile.suspension_reason || '',
      villageIds: payload.scopes
        .filter((scope) => scope.scope_type === 'village')
        .map((scope) => scope.village_id),
      overrides: Object.fromEntries(
        payload.overrides.map((item) => [item.permission_id, item.permission_state])
      )
    });
  }, [userId]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const role = data?.roles.find((item) => item.name === form?.role);
  const rolePermissionIds = useMemo(
    () => data?.rolePermissions
      .filter((item) => item.role_id === role?.id)
      .map((item) => item.permission_id) || [],
    [data, role]
  );

  const applyPermissionPreset = (presetName) => {
    const presetIds = new Set(getPresetPermissionIds(data.permissions, presetName));
    const inheritedIds = new Set(rolePermissionIds);
    const overrides = {};

    data.permissions.forEach((permission) => {
      const shouldAllow = presetIds.has(permission.id);
      const inheritedAllow = inheritedIds.has(permission.id);
      if (shouldAllow !== inheritedAllow) {
        overrides[permission.id] = shouldAllow ? 'allow' : 'deny';
      }
    });

    setForm({ ...form, overrides });
    setMessage(`${PERMISSION_PRESETS[presetName].label} permissions prepared. Click Save Changes to apply them to this account.`);
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    const scopes = form.role === 'super_admin'
      ? [{ scope_type: 'global' }]
      : ['customer', 'guest'].includes(form.role)
        ? [{ scope_type: 'own_records' }]
        : form.villageIds.map((village_id) => ({ scope_type: 'village', village_id }));
    const permissionOverrides = Object.entries(form.overrides)
      .filter(([, state]) => state !== 'inherit')
      .map(([permission_id, permission_state]) => ({ permission_id, permission_state }));
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: form.full_name,
        phone: form.phone,
        role: form.role,
        ...(limitedMode ? {} : {
          status: form.status,
          suspension_reason: form.status === 'suspended' ? form.suspension_reason : null
        }),
        scopes,
        ...(limitedMode ? {} : { permissionOverrides })
      })
    });
    const payload = await response.json();
    setMessage(response.ok ? 'User access updated successfully.' : payload.error);
    if (response.ok) await load();
    setSaving(false);
  };

  if (!data || !form) {
    return <DashboardShell><div className="py-20 text-center">{message || 'Loading user...'}</div></DashboardShell>;
  }

  const tabs = [
    ['profile', 'Profile'],
    ['access', 'Role & Access'],
    ...(!limitedMode ? [['permissions', 'Permissions']] : []),
    ['activity', 'Activity Logs']
  ];

  return (
    <DashboardShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <AdminPageHeader
          eyebrow="User Management"
          title={data.profile.full_name}
          subtitle={data.profile.email}
          actions={(
            <>
              <AdminStatusBadge status={data.profile.status} />
              <button onClick={() => router.push(backHref)} className="rounded-xl border border-[#dbe4ee] bg-white px-4 py-2.5 text-xs font-bold">
                Back to Users
              </button>
            </>
          )}
        />
        {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</div>}
        <div className="flex flex-wrap gap-2 rounded-2xl border border-[#e2e8f0] bg-white p-2 shadow-sm">
          {tabs.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} className={`rounded-xl px-4 py-2.5 text-xs font-extrabold ${tab === key ? 'bg-emerald-600 text-white' : 'text-[#64748b] hover:bg-[#f8fafc]'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <AdminSectionCard title="Profile Information">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-bold text-[#64748b]">
                Full name
                <input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} className="mt-2 w-full rounded-xl border border-[#dbe4ee] px-3 py-2.5 text-sm" />
              </label>
              <label className="text-xs font-bold text-[#64748b]">
                Email
                <input readOnly value={data.profile.email} className="mt-2 w-full rounded-xl border border-[#dbe4ee] bg-[#f8fafc] px-3 py-2.5 text-sm" />
              </label>
              <label className="text-xs font-bold text-[#64748b]">
                Phone
                <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-2 w-full rounded-xl border border-[#dbe4ee] px-3 py-2.5 text-sm" />
              </label>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-[#64748b]">Last login</p><p className="mt-2 font-bold">{data.profile.last_login_at ? new Date(data.profile.last_login_at).toLocaleString() : 'Not recorded'}</p></div>
                <div><p className="text-xs text-[#64748b]">Created</p><p className="mt-2 font-bold">{new Date(data.profile.created_at).toLocaleString()}</p></div>
              </div>
            </div>
          </AdminSectionCard>
        )}

        {tab === 'access' && (
          <AdminSectionCard title="Role & Access Scope">
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-bold text-[#64748b]">
                  Role
                  {limitedMode ? (
                    <div className="mt-2 rounded-xl border border-[#dbe4ee] bg-[#f8fafc] px-3 py-2.5 text-sm capitalize">
                      {form.role.replaceAll('_', ' ')}
                    </div>
                  ) : (
                    <UserRoleSelector roles={data.roles} value={form.role} onChange={(roleValue) => setForm({ ...form, role: roleValue, villageIds: [] })} />
                  )}
                </label>
                {!limitedMode && <label className="text-xs font-bold text-[#64748b]">
                  Account Status
                  <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="mt-2 w-full rounded-xl border border-[#dbe4ee] px-3 py-2.5">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </label>}
              </div>
              {!limitedMode && form.status === 'suspended' && (
                <label className="block text-xs font-bold text-[#64748b]">
                  Suspension reason
                  <textarea value={form.suspension_reason} onChange={(event) => setForm({ ...form, suspension_reason: event.target.value })} className="mt-2 w-full rounded-xl border border-[#dbe4ee] p-3" />
                </label>
              )}
              {!['super_admin', 'customer', 'guest'].includes(form.role) && (
                <UserAccessScopeManager villages={data.villages} selectedVillageIds={form.villageIds} onChange={(villageIds) => setForm({ ...form, villageIds })} />
              )}
            </div>
          </AdminSectionCard>
        )}

        {!limitedMode && tab === 'permissions' && (
          <AdminSectionCard title="Account Permissions" subtitle="Check the permissions this account should be allowed to use.">
            <div className="mb-5 rounded-2xl border border-[#dce6e1] bg-[#f8faf9] p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e5f5ef] text-[#16835f]">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-extrabold text-[#223129]">Permission Presets</p>
                  <p className="text-xs text-[#718078]">Choose a starting permission set for this account.</p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(PERMISSION_PRESETS).map(([name, preset]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => applyPermissionPreset(name)}
                    className="rounded-xl border border-[#d8e1dd] bg-white p-3 text-left transition hover:border-[#79bda5] hover:bg-[#eef8f4]"
                  >
                    <span className="block text-xs font-extrabold text-[#223129]">{preset.label}</span>
                    <span className="mt-1 block text-[11px] leading-4 text-[#718078]">{preset.description}</span>
                  </button>
                ))}
              </div>
            </div>
            <PermissionMatrix
              permissions={data.permissions}
              rolePermissionIds={rolePermissionIds}
              overrides={form.overrides}
              onOverrideChange={(id, state) => setForm({ ...form, overrides: { ...form.overrides, [id]: state } })}
              checkboxMode
            />
          </AdminSectionCard>
        )}

        {tab === 'activity' && (
          <AdminSectionCard title="User Audit Trail"><UserActivityPanel logs={data.logs} /></AdminSectionCard>
        )}

        {tab !== 'activity' && (
          <div className="flex justify-end">
            <button disabled={saving} onClick={save} className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-extrabold text-white disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
