'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import DashboardShell from '@/components/layout/DashboardShell';
import {
  Users,
  Search,
  Filter,
  Loader2,
  Shield,
  Building,
  PencilRuler,
  CreditCard,
  User,
  Trash2,
  Save,
  X,
  Plus,
  ChevronDown
} from 'lucide-react';

const ROLES = [
  { value: 'super_admin', label: 'Super Admin', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  { value: 'village_admin', label: 'Village Admin', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { value: 'accounting', label: 'Accounting', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  { value: 'architect', label: 'Architect', color: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
  { value: 'customer', label: 'Customer', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' }
];

function getRoleBadge(role) {
  const r = ROLES.find(r => r.value === role);
  if (!r) return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  return r.color;
}

function getRoleLabel(role) {
  const r = ROLES.find(r => r.value === role);
  return r ? r.label : role;
}

function getRoleIcon(role) {
  switch (role) {
    case 'super_admin': return Shield;
    case 'village_admin': return Building;
    case 'accounting': return CreditCard;
    case 'architect': return PencilRuler;
    default: return User;
  }
}

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase() || 'U';
}

export default function SuperAdminAccountsPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState([]);
  const [villages, setVillages] = useState([]);
  const [userVillages, setUserVillages] = useState([]);

  // Filters
  const [roleFilter, setRoleFilter] = useState('');
  const [villageFilter, setVillageFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Edit modal
  const [editUser, setEditUser] = useState(null);
  const [editRole, setEditRole] = useState('');
  const [editVillageIds, setEditVillageIds] = useState([]);
  const [editVillageRole, setEditVillageRole] = useState('village_admin');
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState({ msg: '', type: '' });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: '' }), 3500);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [profilesRes, villagesRes, uvRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('villages').select('*').order('name', { ascending: true }),
        supabase.from('user_villages').select('*')
      ]);

      setProfiles(profilesRes.data || []);
      setVillages(villagesRes.data || []);
      setUserVillages(uvRes.data || []);
    } catch (err) {
      console.error('Error loading accounts data:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => fetchData(), 0);
    return () => clearTimeout(timer);
  }, [fetchData]);

  // Get villages assigned to a user
  const getUserVillages = (userId) => {
    const uvs = userVillages.filter(uv => uv.user_id === userId);
    return uvs.map(uv => {
      const village = villages.find(v => v.id === uv.village_id);
      return { ...uv, villageName: village?.name || 'Unknown' };
    });
  };

  // Filtered profiles
  const filtered = profiles.filter(p => {
    if (roleFilter && p.role !== roleFilter) return false;
    if (villageFilter) {
      const hasVillage = userVillages.some(uv => uv.user_id === p.id && uv.village_id === villageFilter);
      if (!hasVillage && p.role !== 'super_admin' && p.role !== 'customer') return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match = p.full_name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Open edit modal
  const openEdit = (profile) => {
    setEditUser(profile);
    setEditRole(profile.role);
    const uvs = userVillages.filter(uv => uv.user_id === profile.id);
    setEditVillageIds(uvs.map(uv => uv.village_id));
    setEditVillageRole(uvs[0]?.role || 'village_admin');
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      // 1. Update role in profiles
      const { error: roleError } = await supabase
        .from('profiles')
        .update({ role: editRole, updated_at: new Date().toISOString() })
        .eq('id', editUser.id);

      if (roleError) throw roleError;

      // 2. Sync user_villages: delete old, insert new
      await supabase.from('user_villages').delete().eq('user_id', editUser.id);

      if (editVillageIds.length > 0 && editRole !== 'customer' && editRole !== 'super_admin') {
        const rows = editVillageIds.map(vid => ({
          user_id: editUser.id,
          village_id: vid,
          role: editRole === 'village_admin' ? 'village_admin' : editRole
        }));
        const { error: uvError } = await supabase.from('user_villages').insert(rows);
        if (uvError) throw uvError;
      }

      showToast(`${editUser.full_name}'s account updated successfully.`);
      setEditUser(null);
      fetchData();
    } catch (err) {
      showToast(err.message || 'Failed to update account.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Delete account (profile only — Auth user remains)
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // Delete user_villages first
      await supabase.from('user_villages').delete().eq('user_id', deleteTarget.id);
      // Delete profile
      const { error } = await supabase.from('profiles').delete().eq('id', deleteTarget.id);
      if (error) throw error;

      showToast(`${deleteTarget.full_name}'s profile has been removed.`);
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      showToast(err.message || 'Failed to delete account.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Toggle village in edit list
  const toggleEditVillage = (villageId) => {
    setEditVillageIds(prev =>
      prev.includes(villageId)
        ? prev.filter(id => id !== villageId)
        : [...prev, villageId]
    );
  };

  // Stats
  const totalUsers = profiles.length;
  const adminCount = profiles.filter(p => p.role === 'super_admin' || p.role === 'village_admin').length;
  const customerCount = profiles.filter(p => p.role === 'customer').length;
  const staffCount = profiles.filter(p => p.role === 'accounting' || p.role === 'architect').length;

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex min-h-[520px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-[1400px] space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-[#e2e8f0] pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-600">System Administration</p>
            <h1 className="mt-2 text-3xl font-extrabold text-[#272727]">Manage Accounts</h1>
            <p className="mt-1 max-w-2xl text-sm text-[#64748b]">
              View, edit, and manage all user accounts across the entire iReserve system. Filter by role and village assignment.
            </p>
          </div>
        </div>

        {/* Toast */}
        {toast.msg && (
          <div className={`rounded-xl border p-4 text-xs font-bold flex items-center gap-2 ${
            toast.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-600'
              : 'border-emerald-200 bg-emerald-50 text-emerald-600'
          }`}>
            {toast.msg}
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">Total Users</span>
            <p className="mt-1 text-2xl font-extrabold text-[#272727]">{totalUsers}</p>
          </div>
          <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">Admins</span>
            <p className="mt-1 text-2xl font-extrabold text-[#272727]">{adminCount}</p>
          </div>
          <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">Staff</span>
            <p className="mt-1 text-2xl font-extrabold text-[#272727]">{staffCount}</p>
          </div>
          <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">Customers</span>
            <p className="mt-1 text-2xl font-extrabold text-[#272727]">{customerCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-1.5 text-[#64748b] text-xs font-bold select-none">
            <Filter className="h-4 w-4 text-emerald-500" />
            <span>Filters:</span>
          </div>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-[#dbe4ee] bg-[#f8fafc] py-2 pl-9 pr-3 text-sm text-[#272727] outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-[#dbe4ee] bg-[#f8fafc] px-3 py-2 text-xs font-bold text-[#64748b] outline-none cursor-pointer"
          >
            <option value="">All Roles</option>
            {ROLES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          <select
            value={villageFilter}
            onChange={(e) => setVillageFilter(e.target.value)}
            className="rounded-lg border border-[#dbe4ee] bg-[#f8fafc] px-3 py-2 text-xs font-bold text-[#64748b] outline-none cursor-pointer"
          >
            <option value="">All Villages</option>
            {villages.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>

        {/* Accounts Table */}
        <div className="rounded-2xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium border-collapse">
              <thead>
                <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[#94a3b8] uppercase tracking-wider text-[10px] select-none">
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Email</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Village Assignments</th>
                  <th className="py-3.5 px-4">Joined</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <Users className="mx-auto h-10 w-10 text-[#dbe4ee] mb-3" />
                      <p className="text-sm font-bold text-[#94a3b8]">No accounts found</p>
                      <p className="text-xs text-[#cbd5e1] mt-1">Try adjusting your filters.</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => {
                    const Icon = getRoleIcon(p.role);
                    const uvs = getUserVillages(p.id);
                    return (
                      <tr key={p.id} className="hover:bg-[#f8fafc] transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-extrabold text-emerald-700">
                              {initials(p.full_name)}
                            </div>
                            <span className="font-extrabold text-[#272727]">{p.full_name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-[#64748b]">{p.email}</td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase ${getRoleBadge(p.role)}`}>
                            <Icon className="h-3 w-3" />
                            {getRoleLabel(p.role)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {uvs.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {uvs.map(uv => (
                                <span key={uv.id} className="rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-600">
                                  {uv.villageName}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-[#cbd5e1] italic">
                              {p.role === 'super_admin' ? 'Global access' : p.role === 'customer' ? '—' : 'Unassigned'}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-[#94a3b8]">
                          {new Date(p.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEdit(p)}
                              className="rounded-lg border border-[#dbe4ee] bg-white px-3 py-1.5 text-[10px] font-extrabold text-[#64748b] shadow-sm transition hover:bg-[#f8fafc] hover:text-emerald-600 cursor-pointer"
                            >
                              Edit
                            </button>
                            {p.role !== 'super_admin' && (
                              <button
                                onClick={() => setDeleteTarget(p)}
                                className="rounded-lg border border-red-100 bg-white px-2 py-1.5 text-red-400 shadow-sm transition hover:bg-red-50 hover:text-red-600 cursor-pointer"
                                title="Remove account"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Results count */}
          <div className="border-t border-[#f1f5f9] bg-[#f8fafc] px-4 py-3 text-[10px] font-bold text-[#94a3b8]">
            Showing {filtered.length} of {totalUsers} accounts
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#272727]/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-4 mb-5">
              <h3 className="text-lg font-extrabold text-[#272727]">Edit Account</h3>
              <button onClick={() => setEditUser(null)} className="rounded-lg p-1.5 text-[#94a3b8] transition hover:bg-[#f1f5f9] hover:text-[#272727] cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* User Info */}
            <div className="flex items-center gap-3 mb-6 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-sm font-extrabold text-emerald-700">
                {initials(editUser.full_name)}
              </div>
              <div>
                <p className="font-extrabold text-[#272727]">{editUser.full_name}</p>
                <p className="text-xs text-[#64748b]">{editUser.email}</p>
              </div>
            </div>

            {/* Role selector */}
            <div className="mb-5">
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-[#64748b]">System Role</label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                className="w-full rounded-lg border border-[#dbe4ee] bg-white px-3 py-2.5 text-sm font-bold text-[#272727] outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 cursor-pointer"
              >
                {ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {/* Village Assignments (only for non-customer, non-super_admin) */}
            {editRole !== 'customer' && editRole !== 'super_admin' && (
              <div className="mb-5">
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-[#64748b]">Village Assignments</label>
                <div className="max-h-40 overflow-y-auto rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3 space-y-2">
                  {villages.length === 0 ? (
                    <p className="text-xs text-[#94a3b8] italic">No villages found.</p>
                  ) : (
                    villages.map(v => (
                      <label key={v.id} className="flex items-center gap-2.5 cursor-pointer rounded-lg px-2 py-1.5 transition hover:bg-white">
                        <input
                          type="checkbox"
                          checked={editVillageIds.includes(v.id)}
                          onChange={() => toggleEditVillage(v.id)}
                          className="h-4 w-4 rounded border-[#dbe4ee] text-emerald-500 focus:ring-emerald-500/20 cursor-pointer accent-emerald-500"
                        />
                        <span className="text-sm font-bold text-[#272727]">{v.name}</span>
                        <span className="text-[10px] text-[#94a3b8]">{v.city}, {v.province}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-4 border-t border-[#e2e8f0]">
              <button
                onClick={() => setEditUser(null)}
                className="rounded-lg border border-[#dbe4ee] bg-white px-4 py-2.5 text-xs font-bold text-[#64748b] transition hover:bg-[#f8fafc] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60 cursor-pointer"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#272727]/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-2xl text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 border border-red-100">
              <Trash2 className="h-6 w-6 text-red-500" />
            </div>
            <h3 className="text-lg font-extrabold text-[#272727] mb-2">Remove Account?</h3>
            <p className="text-xs text-[#64748b] mb-6 leading-relaxed">
              This will remove <strong>{deleteTarget.full_name}</strong>&apos;s profile and all village assignments. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-[#dbe4ee] bg-white px-5 py-2.5 text-xs font-bold text-[#64748b] transition hover:bg-[#f8fafc] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-red-500 disabled:opacity-60 cursor-pointer"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
