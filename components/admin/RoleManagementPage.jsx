'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RotateCcw, Shield, Sparkles, Users } from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import AdminPageHeader from './AdminPageHeader';
import AdminSectionCard from './AdminSectionCard';
import RolePermissionEditor from './RolePermissionEditor';
import { getPresetPermissionIds, PERMISSION_PRESETS } from '@/lib/auth/permissionPresets';

export default function RoleManagementPage() {
  const [data, setData] = useState({ roles: [], permissions: [], rolePermissions: [], profiles: [] });
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [presetName, setPresetName] = useState('village_admin');
  const [newRole, setNewRole] = useState({ name: '', displayName: '', description: '' });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/roles');
    const payload = await response.json();
    if (response.ok) {
      setData(payload);
      setSelectedRoleId((current) => current || payload.roles[0]?.id || '');
    } else {
      setMessage(payload.error);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const selectedRole = data.roles.find((role) => role.id === selectedRoleId);

  useEffect(() => {
    const timer = setTimeout(() => {
      const permissionIds = selectedRole?.name === 'super_admin'
        ? data.permissions.map((permission) => permission.id)
        : data.rolePermissions
          .filter((item) => item.role_id === selectedRoleId)
          .map((item) => item.permission_id);
      setSelectedIds(permissionIds);
      setPresetName(PERMISSION_PRESETS[selectedRole?.name] ? selectedRole.name : 'village_admin');
    }, 0);
    return () => clearTimeout(timer);
  }, [data.permissions, data.rolePermissions, selectedRole, selectedRoleId]);

  const counts = useMemo(
    () => Object.fromEntries(
      data.roles.map((role) => [
        role.name,
        data.profiles.filter((profile) => profile.role === role.name).length
      ])
    ),
    [data]
  );

  const savePermissions = async () => {
    setSaving(true);
    const response = await fetch('/api/admin/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save_permissions',
        roleId: selectedRoleId,
        permissionIds: selectedIds
      })
    });
    const payload = await response.json();
    setMessage(response.ok ? 'Role permissions updated.' : payload.error);
    if (response.ok) await load();
    setSaving(false);
  };

  const applyPreset = async () => {
    if (!selectedRole || selectedRole.name === 'super_admin') return;
    setSaving(true);
    const response = await fetch('/api/admin/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'apply_preset', roleId: selectedRole.id, presetName })
    });
    const payload = await response.json();
    setMessage(response.ok ? `${PERMISSION_PRESETS[presetName].label} preset applied.` : payload.error);
    if (response.ok) await load();
    setSaving(false);
  };

  const previewPreset = (name) => {
    setPresetName(name);
    setSelectedIds(getPresetPermissionIds(data.permissions, name));
    setMessage(`${PERMISSION_PRESETS[name].label} preset previewed. Save or apply it to keep these permissions.`);
  };

  const restoreAllPresets = async () => {
    setSaving(true);
    const response = await fetch('/api/admin/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore_system_presets' })
    });
    const payload = await response.json();
    setMessage(response.ok ? 'All system role presets were restored.' : payload.error);
    if (response.ok) await load();
    setSaving(false);
  };

  const createRole = async (event) => {
    event.preventDefault();
    const response = await fetch('/api/admin/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRole)
    });
    const payload = await response.json();
    setMessage(response.ok ? 'Custom role created.' : payload.error);
    if (response.ok) {
      setNewRole({ name: '', displayName: '', description: '' });
      await load();
    }
  };

  return (
    <DashboardShell>
      <div className="mx-auto max-w-[1500px] space-y-6">
        <AdminPageHeader
          eyebrow="Dynamic RBAC"
          title="Roles & Permissions"
          subtitle="Use recommended presets as a secure starting point, then customize individual permissions when needed."
          actions={(
            <button
              disabled={saving}
              onClick={restoreAllPresets}
              className="inline-flex items-center gap-2 rounded-xl border border-[#d5ded9] bg-white px-4 py-2.5 text-xs font-extrabold text-[#405149] transition hover:bg-[#f4f7f5] disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              Restore All Presets
            </button>
          )}
        />

        {message && (
          <div className="rounded-xl border border-[#b7dfcf] bg-[#eef8f4] p-3 text-sm font-bold text-[#13795b]">
            {message}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-6">
            <AdminSectionCard title="Roles">
              {data.roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRoleId(role.id)}
                  className={`mb-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                    selectedRoleId === role.id
                      ? 'border-[#b7dfcf] bg-[#eef8f4]'
                      : 'border-[#e1e7e4] hover:bg-[#f8faf9]'
                  }`}
                >
                  <Shield className={`h-5 w-5 ${selectedRoleId === role.id ? 'text-[#16835f]' : 'text-[#8b9992]'}`} />
                  <span className="flex-1">
                    <span className="block font-extrabold text-[#223129]">{role.display_name}</span>
                    <span className="line-clamp-2 text-xs text-[#718078]">{role.description}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#718078]">
                    <Users className="h-3 w-3" />{counts[role.name] || 0}
                  </span>
                </button>
              ))}
            </AdminSectionCard>

            <AdminSectionCard title="Create Custom Role">
              <form onSubmit={createRole} className="space-y-3">
                <input required placeholder="role_name" value={newRole.name} onChange={(event) => setNewRole({ ...newRole, name: event.target.value })} className="w-full rounded-xl border border-[#d8e1dd] px-3 py-2.5 text-sm" />
                <input required placeholder="Display name" value={newRole.displayName} onChange={(event) => setNewRole({ ...newRole, displayName: event.target.value })} className="w-full rounded-xl border border-[#d8e1dd] px-3 py-2.5 text-sm" />
                <textarea placeholder="Description" value={newRole.description} onChange={(event) => setNewRole({ ...newRole, description: event.target.value })} className="w-full rounded-xl border border-[#d8e1dd] p-3 text-sm" />
                <button className="inline-flex items-center gap-2 rounded-xl bg-[#16835f] px-4 py-2.5 text-xs font-extrabold text-white">
                  <Plus className="h-4 w-4" />Create Role
                </button>
              </form>
            </AdminSectionCard>
          </div>

          <div className="space-y-6">
            <AdminSectionCard
              title="Permission Presets"
              subtitle="Apply a recommended permission bundle to the selected role."
            >
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Object.entries(PERMISSION_PRESETS).map(([name, preset]) => {
                  const count = getPresetPermissionIds(data.permissions, name).length;
                  const active = presetName === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => previewPreset(name)}
                      className={`rounded-xl border p-4 text-left transition ${
                        active
                          ? 'border-[#79bda5] bg-[#eef8f4] ring-2 ring-[#dff3eb]'
                          : 'border-[#e1e7e4] bg-white hover:bg-[#f8faf9]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-extrabold text-[#223129]">{preset.label}</span>
                        <span className="rounded-full bg-[#f1f5f3] px-2 py-1 text-[10px] font-bold text-[#52635b]">
                          {count} permissions
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[#718078]">{preset.description}</p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e1e7e4] bg-[#f8faf9] p-4">
                <div>
                  <p className="text-sm font-extrabold text-[#223129]">{PERMISSION_PRESETS[presetName]?.label} preset</p>
                  <p className="text-xs text-[#718078]">This replaces the selected role&apos;s current permission grants.</p>
                </div>
                <button
                  disabled={!selectedRole || selectedRole.name === 'super_admin' || saving}
                  onClick={applyPreset}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#16835f] px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#116d50] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Sparkles className="h-4 w-4" />
                  Apply to {selectedRole?.display_name || 'Role'}
                </button>
              </div>
            </AdminSectionCard>

            <AdminSectionCard
              title={selectedRole?.display_name || 'Permission Matrix'}
              subtitle={selectedRole?.name === 'super_admin'
                ? 'Super Admin automatically receives every system permission.'
                : selectedRole?.description}
              actions={(
                <button
                  disabled={!selectedRole || selectedRole.name === 'super_admin' || saving}
                  onClick={savePermissions}
                  className="rounded-xl bg-[#16835f] px-4 py-2.5 text-xs font-extrabold text-white disabled:opacity-40"
                >
                  {saving ? 'Saving...' : 'Save Custom Permissions'}
                </button>
              )}
            >
              <RolePermissionEditor
                permissions={data.permissions}
                selectedIds={selectedIds}
                onChange={setSelectedIds}
                disabled={selectedRole?.name === 'super_admin'}
              />
            </AdminSectionCard>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
