'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import UserAccessScopeManager from './UserAccessScopeManager';

export default function UserFormDialog({ open, villages, onClose, onCreated }) {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', role: 'customer', status: 'active', villageIds: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  if (!open) return null;
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      onCreated?.(payload.userId);
      onClose();
    } catch (err) { setError(err.message || 'User could not be created.'); } finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#272727]/50 p-4 backdrop-blur-sm"><form onSubmit={submit} className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-[#e2e8f0] px-6 py-4"><div><p className="text-xs font-extrabold uppercase text-emerald-600">User Management</p><h2 className="mt-1 text-xl font-extrabold">Create User</h2></div><button type="button" onClick={onClose}><X /></button></div><div className="grid gap-4 p-6 sm:grid-cols-2">{error && <p className="sm:col-span-2 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-600">{error}</p>}<label className="text-xs font-bold text-[#64748b]">Full Name<input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="mt-2 w-full rounded-xl border border-[#dbe4ee] px-3 py-2.5 text-sm" /></label><label className="text-xs font-bold text-[#64748b]">Email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-2 w-full rounded-xl border border-[#dbe4ee] px-3 py-2.5 text-sm" /></label><label className="text-xs font-bold text-[#64748b]">Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-2 w-full rounded-xl border border-[#dbe4ee] px-3 py-2.5 text-sm" /></label><label className="text-xs font-bold text-[#64748b]">Temporary Password<input required minLength={8} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-2 w-full rounded-xl border border-[#dbe4ee] px-3 py-2.5 text-sm" /></label><label className="text-xs font-bold text-[#64748b]">Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, villageIds: [] })} className="mt-2 w-full rounded-xl border border-[#dbe4ee] px-3 py-2.5 text-sm"><option value="super_admin">Super Admin</option><option value="village_admin">Village Admin</option><option value="accounting">Accounting</option><option value="architect">Architect</option><option value="customer">Customer</option><option value="guest">Guest</option></select></label><label className="text-xs font-bold text-[#64748b]">Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-2 w-full rounded-xl border border-[#dbe4ee] px-3 py-2.5 text-sm"><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></label>{!['super_admin', 'customer', 'guest'].includes(form.role) && <div className="sm:col-span-2"><p className="mb-2 text-xs font-bold text-[#64748b]">Village Access</p><UserAccessScopeManager villages={villages} selectedVillageIds={form.villageIds} onChange={(villageIds) => setForm({ ...form, villageIds })} /></div>}</div><div className="flex justify-end gap-2 border-t border-[#e2e8f0] bg-[#f8fafc] p-4"><button type="button" onClick={onClose} className="rounded-xl border border-[#dbe4ee] bg-white px-4 py-2.5 text-xs font-bold">Cancel</button><button disabled={saving} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-extrabold text-white disabled:opacity-50">{saving ? 'Creating...' : 'Create User'}</button></div></form></div>;
}
