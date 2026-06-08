'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import DashboardShell from '@/components/layout/DashboardShell';
import { getManageableVillages } from '@/lib/villages/getManageableVillages';
import AccountConfirmDialog from '@/components/accounts/AccountConfirmDialog';
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
  X
} from 'lucide-react';

const MANAGEABLE_ROLES = [
  { value: 'accounting', label: 'Accounting', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  { value: 'architect', label: 'Architect', color: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
  { value: 'customer', label: 'Customer', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' }
];

const ALL_DISPLAY_ROLES = [
  { value: 'village_admin', label: 'Village Admin', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  ...MANAGEABLE_ROLES
];

function getRoleBadge(role) {
  const r = ALL_DISPLAY_ROLES.find(r => r.value === role);
  if (!r) return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  return r.color;
}

function getRoleLabel(role) {
  const r = ALL_DISPLAY_ROLES.find(r => r.value === role);
  return r ? r.label : role;
}

function getRoleIcon(role) {
  switch (role) {
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

export default function VillageAdminAccountsPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [myVillages, setMyVillages] = useState([]);
  const [selectedVillageId, setSelectedVillageId] = useState('');

  // User data
  const [profiles, setProfiles] = useState([]);
  const [userVillages, setUserVillages] = useState([]);

  // Filters
  const [roleFilter, setRoleFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Edit modal
  const [editUser, setEditUser] = useState(null);
  const [editRole, setEditRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState({ msg: '', type: '' });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: '' }), 3500);
  };

  // Fetch all data
  const fetchData = useCallback(async (villageId) => {
    setLoading(true);
    try {
      // Get all user_villages for the selected village
      const { data: uvData } = await supabase
        .from('user_villages')
        .select('*, profiles(*)')
        .eq('village_id', villageId);

      setUserVillages(uvData || []);

      // Extract user IDs assigned to this village
      const userIds = (uvData || []).map(uv => uv.user_id).filter(Boolean);

      // Also get customers who have reservations in this village
      const { data: reservationCustomers } = await supabase
        .from('reservations')
        .select('customer_id, profiles!reservations_customer_id_fkey(*)')
        .eq('village_id', villageId)
        .not('customer_id', 'is', null);

      // Build unique profile list
      const profileMap = new Map();

      // Add users assigned to this village (via user_villages)
      for (const uv of (uvData || [])) {
        if (uv.profiles && uv.profiles.role !== 'super_admin') {
          profileMap.set(uv.profiles.id, uv.profiles);
        }
      }

      // Add customers with reservations in this village
      for (const rc of (reservationCustomers || [])) {
        if (rc.profiles && rc.profiles.role === 'customer') {
          profileMap.set(rc.profiles.id, rc.profiles);
        }
      }

      // Filter out village admins of OTHER villages (not this one)
      const villageAdminIdsHere = new Set(
        (uvData || []).filter(uv => uv.role === 'village_admin').map(uv => uv.user_id)
      );

      const filteredProfiles = Array.from(profileMap.values()).filter(p => {
        // Never show super admins
        if (p.role === 'super_admin') return false;
        // If village_admin, only show if assigned to THIS village
        if (p.role === 'village_admin' && !villageAdminIdsHere.has(p.id)) return false;
        return true;
      });

      setProfiles(filteredProfiles);
    } catch (err) {
      console.error('Error loading village accounts:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Initial setup
  const fetchInit = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const vList = await getManageableVillages(supabase, user.id);
      setMyVillages(vList);

      if (vList.length > 0) {
        setSelectedVillageId(vList[0].id);
        await fetchData(vList[0].id);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error('Error initializing village accounts:', err);
      setLoading(false);
    }
  }, [supabase, fetchData]);

  useEffect(() => {
    const timer = setTimeout(() => fetchInit(), 0);
    return () => clearTimeout(timer);
  }, [fetchInit]);

  const handleVillageChange = (e) => {
    const vId = e.target.value;
    setSelectedVillageId(vId);
    fetchData(vId);
  };

  // Get the village role for a user in the selected village
  const getUserVillageRole = (userId) => {
    const uv = userVillages.find(uv => uv.user_id === userId);
    return uv?.role || null;
  };

  // Can current user edit this profile?
  const canEdit = (profile) => {
    // Can't edit yourself
    if (profile.id === currentUserId) return false;
    // Can't edit other village admins
    if (profile.role === 'village_admin') return false;
    return true;
  };

  // Can current user delete this profile?
  const canDelete = (profile) => {
    if (profile.id === currentUserId) return false;
    if (profile.role === 'village_admin') return false;
    if (profile.role === 'super_admin') return false;
    return true;
  };

  // Filter
  const filtered = profiles.filter(p => {
    if (roleFilter && p.role !== roleFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return p.full_name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q);
    }
    return true;
  });

  // Open edit modal
  const openEdit = (profile) => {
    setEditUser(profile);
    setEditRole(profile.role);
  };

  // Save edit (role change + village assignment update)
  const handleSaveEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      // 1. Update profile role
      const { error: roleError } = await supabase
        .from('profiles')
        .update({ role: editRole, updated_at: new Date().toISOString() })
        .eq('id', editUser.id);

      if (roleError) throw roleError;

      // 2. Update user_villages for this village if role changed
      if (editRole !== 'customer') {
        // Upsert: delete old entry for this village, then insert new
        await supabase
          .from('user_villages')
          .delete()
          .eq('user_id', editUser.id)
          .eq('village_id', selectedVillageId);

        const { error: uvError } = await supabase.from('user_villages').insert({
          user_id: editUser.id,
          village_id: selectedVillageId,
          role: editRole
        });
        if (uvError) throw uvError;
      } else {
        // If changed to customer, remove village assignment
        await supabase
          .from('user_villages')
          .delete()
          .eq('user_id', editUser.id)
          .eq('village_id', selectedVillageId);
      }

      showToast(`${editUser.full_name}'s role updated to ${getRoleLabel(editRole)}.`);
      setConfirmSave(false);
      setEditUser(null);
      fetchData(selectedVillageId);
    } catch (err) {
      showToast(err.message || 'Failed to update account.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Delete (remove from village scope only)
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // Remove user_village assignment for this village
      await supabase
        .from('user_villages')
        .delete()
        .eq('user_id', deleteTarget.id)
        .eq('village_id', selectedVillageId);

      showToast(`${deleteTarget.full_name} removed from this village scope.`);
      setDeleteTarget(null);
      fetchData(selectedVillageId);
    } catch (err) {
      showToast(err.message || 'Failed to remove account.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const selectedVillageName = myVillages.find(v => v.id === selectedVillageId)?.name || '';

  if (loading && myVillages.length === 0) {
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
            <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-600">Village Administration</p>
            <h1 className="mt-2 text-3xl font-extrabold text-[#272727]">Manage Accounts</h1>
            <p className="mt-1 max-w-2xl text-sm text-[#64748b]">
              View and manage user accounts within your assigned village scope. You can edit staff roles and remove village assignments.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-[#64748b] font-bold uppercase tracking-wider select-none">Village:</span>
            <select
              value={selectedVillageId}
              onChange={handleVillageChange}
              disabled={myVillages.length === 0}
              className="rounded-lg border border-[#dbe4ee] bg-white px-4 py-2.5 text-xs font-bold text-[#272727] outline-none shadow-sm cursor-pointer transition focus:border-emerald-500"
            >
              {myVillages.length === 0 ? (
                <option value="">No villages assigned</option>
              ) : (
                myVillages.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))
              )}
            </select>
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
            {ALL_DISPLAY_ROLES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Accounts Table */}
        <div className="rounded-2xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-medium border-collapse">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[#94a3b8] uppercase tracking-wider text-[10px] select-none">
                    <th className="py-3.5 px-4">User</th>
                    <th className="py-3.5 px-4">Email</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Village Role</th>
                    <th className="py-3.5 px-4">Joined</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <Users className="mx-auto h-10 w-10 text-[#dbe4ee] mb-3" />
                        <p className="text-sm font-bold text-[#94a3b8]">No accounts found in this village</p>
                        <p className="text-xs text-[#cbd5e1] mt-1">Try adjusting your filters or selecting another village.</p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p) => {
                      const Icon = getRoleIcon(p.role);
                      const villageRole = getUserVillageRole(p.id);
                      return (
                        <tr key={p.id} className="hover:bg-[#f8fafc] transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-extrabold text-emerald-700">
                                {initials(p.full_name)}
                              </div>
                              <div>
                                <span className="font-extrabold text-[#272727] block">{p.full_name}</span>
                                {p.id === currentUserId && (
                                  <span className="text-[9px] font-bold text-emerald-500 uppercase">You</span>
                                )}
                              </div>
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
                            {villageRole ? (
                              <span className="rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-600 capitalize">
                                {villageRole.replace('_', ' ')}
                              </span>
                            ) : (
                              <span className="text-[10px] text-[#cbd5e1] italic">Customer</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-[#94a3b8]">
                            {new Date(p.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {canEdit(p) && (
                                <button
                                  onClick={() => openEdit(p)}
                                  className="rounded-lg border border-[#dbe4ee] bg-white px-3 py-1.5 text-[10px] font-extrabold text-[#64748b] shadow-sm transition hover:bg-[#f8fafc] hover:text-emerald-600 cursor-pointer"
                                >
                                  Edit
                                </button>
                              )}
                              {canDelete(p) && (
                                <button
                                  onClick={() => setDeleteTarget(p)}
                                  className="rounded-lg border border-red-100 bg-white px-2 py-1.5 text-red-400 shadow-sm transition hover:bg-red-50 hover:text-red-600 cursor-pointer"
                                  title="Remove from village"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {!canEdit(p) && !canDelete(p) && (
                                <span className="text-[10px] text-[#cbd5e1] italic">No action</span>
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
          )}

          {/* Results count */}
          <div className="border-t border-[#f1f5f9] bg-[#f8fafc] px-4 py-3 text-[10px] font-bold text-[#94a3b8]">
            Showing {filtered.length} accounts in {selectedVillageName || 'village'}
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

            {/* Role selector — only manageable roles */}
            <div className="mb-5">
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
                Role in {selectedVillageName}
              </label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                className="w-full rounded-lg border border-[#dbe4ee] bg-white px-3 py-2.5 text-sm font-bold text-[#272727] outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 cursor-pointer"
              >
                {MANAGEABLE_ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <p className="mt-2 text-[10px] text-[#94a3b8]">
                Changing the role will also update this user&apos;s village assignment for {selectedVillageName}.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-4 border-t border-[#e2e8f0]">
              <button
                onClick={() => setEditUser(null)}
                className="rounded-lg border border-[#dbe4ee] bg-white px-4 py-2.5 text-xs font-bold text-[#64748b] transition hover:bg-[#f8fafc] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => setConfirmSave(true)}
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

      <AccountConfirmDialog
        open={confirmSave && Boolean(editUser)}
        title="Confirm Account Changes?"
        description={(
          <p>
            Change <strong>{editUser?.full_name}</strong> to <strong>{getRoleLabel(editRole)}</strong> in{' '}
            <strong>{selectedVillageName}</strong>?
          </p>
        )}
        confirmLabel="Save Changes"
        loading={saving}
        onCancel={() => setConfirmSave(false)}
        onConfirm={handleSaveEdit}
      />

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#272727]/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-2xl text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 border border-red-100">
              <Trash2 className="h-6 w-6 text-red-500" />
            </div>
            <h3 className="text-lg font-extrabold text-[#272727] mb-2">Remove from Village?</h3>
            <p className="text-xs text-[#64748b] mb-6 leading-relaxed">
              This will remove <strong>{deleteTarget.full_name}</strong> from <strong>{selectedVillageName}</strong>. Their system account will remain intact.
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
