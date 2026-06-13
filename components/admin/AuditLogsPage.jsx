'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Eye, FileClock, Filter, Search, X } from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import Pagination from '@/components/shared/Pagination';
import AdminPageHeader from './AdminPageHeader';
import AdminFilterBar from './AdminFilterBar';
import AdminSectionCard from './AdminSectionCard';
import AdminEmptyState from './AdminEmptyState';
import { useRealtimeTable } from '@/lib/realtime/useRealtimeTable';
import { useRealtimeRefresh } from '@/lib/realtime/useRealtimeRefresh';

const AUDIT_PAGE_SIZE = 10;

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export default function AuditLogsPage() {
  const [data, setData] = useState({ logs: [], villages: [], users: [] });
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ from: '', to: '', user: '', role: '', action: '', entity: '', village: '', search: '', sort: 'newest' });
  const [page, setPage] = useState(1);
  const load = useCallback(async () => { const response = await fetch('/api/admin/audit-logs'); const payload = await response.json(); if (response.ok) setData(payload); else setError(payload.error); }, []);
  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);
  const scheduleAuditRefresh = useRealtimeRefresh(load, 250);
  useRealtimeTable({
    table: 'audit_logs',
    event: 'INSERT',
    onChange: scheduleAuditRefresh
  });
  const actions = useMemo(() => [...new Set(data.logs.map((log) => log.action))].sort(), [data.logs]);
  const entities = useMemo(() => [...new Set(data.logs.map((log) => log.entity_type))].sort(), [data.logs]);
  const filtered = useMemo(() => data.logs.filter((log) => {
    const date = String(log.created_at).slice(0, 10);
    if (filters.from && date < filters.from) return false;
    if (filters.to && date > filters.to) return false;
    if (filters.user && log.user_id !== filters.user) return false;
    if (filters.role && log.profiles?.role !== filters.role) return false;
    if (filters.action && log.action !== filters.action) return false;
    if (filters.entity && log.entity_type !== filters.entity) return false;
    if (filters.village && log.village_id !== filters.village) return false;
    const text = `${log.action} ${log.description} ${log.profiles?.full_name} ${log.entity_type} ${JSON.stringify(log.metadata)}`.toLowerCase();
    return !filters.search || text.includes(filters.search.toLowerCase());
  }).sort((a,b) => filters.sort === 'oldest' ? new Date(a.created_at) - new Date(b.created_at) : new Date(b.created_at) - new Date(a.created_at)), [data.logs, filters]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / AUDIT_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedLogs = filtered.slice((currentPage - 1) * AUDIT_PAGE_SIZE, currentPage * AUDIT_PAGE_SIZE);
  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const exportCsv = () => { const headers = ['Date & Time','User','Role','Action','Entity Type','Village','Description','IP Address','User Agent']; const rows = filtered.map((log) => [log.created_at,log.profiles?.full_name,log.profiles?.role,log.action,log.entity_type,log.villages?.name,log.description,log.ip_address,log.user_agent]); const blob = new Blob([[headers,...rows].map((row) => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'ireserve-audit-logs.csv'; anchor.click(); URL.revokeObjectURL(url); };
  return <DashboardShell><div className="mx-auto max-w-[1700px] space-y-6"><AdminPageHeader eyebrow="Governance & Security" title="User Behavior & System Audit Logs" subtitle="Track user activities, account changes, payment actions, reservation updates, blueprint changes, and system events." actions={<button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-extrabold text-white"><Download className="h-4 w-4" />Export CSV</button>} />{error && <p className="rounded-xl bg-red-50 p-4 text-red-600">{error}</p>}<AdminFilterBar><Filter className="h-4 w-4 text-emerald-600" /><div className="relative min-w-56 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94a3b8]" /><input value={filters.search} onChange={(e) => updateFilter('search', e.target.value)} placeholder="Search activity" className="w-full rounded-xl border border-[#dbe4ee] py-2 pl-9 pr-3 text-sm" /></div><input type="date" value={filters.from} onChange={(e) => updateFilter('from', e.target.value)} className="rounded-xl border border-[#dbe4ee] px-3 py-2 text-xs" /><input type="date" value={filters.to} onChange={(e) => updateFilter('to', e.target.value)} className="rounded-xl border border-[#dbe4ee] px-3 py-2 text-xs" /><select value={filters.user} onChange={(e) => updateFilter('user', e.target.value)} className="rounded-xl border border-[#dbe4ee] px-3 py-2 text-xs"><option value="">All users</option>{data.users.map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}</select><select value={filters.role} onChange={(e) => updateFilter('role', e.target.value)} className="rounded-xl border border-[#dbe4ee] px-3 py-2 text-xs"><option value="">All roles</option>{['super_admin','village_admin','accounting','architect','customer','guest'].map((role) => <option key={role} value={role}>{role}</option>)}</select><select value={filters.action} onChange={(e) => updateFilter('action', e.target.value)} className="rounded-xl border border-[#dbe4ee] px-3 py-2 text-xs"><option value="">All actions</option>{actions.map((action) => <option key={action}>{action}</option>)}</select><select value={filters.entity} onChange={(e) => updateFilter('entity', e.target.value)} className="rounded-xl border border-[#dbe4ee] px-3 py-2 text-xs"><option value="">All entities</option>{entities.map((entity) => <option key={entity}>{entity}</option>)}</select><select value={filters.village} onChange={(e) => updateFilter('village', e.target.value)} className="rounded-xl border border-[#dbe4ee] px-3 py-2 text-xs"><option value="">All villages</option>{data.villages.map((village) => <option key={village.id} value={village.id}>{village.name}</option>)}</select><select value={filters.sort} onChange={(e) => updateFilter('sort', e.target.value)} className="rounded-xl border border-[#dbe4ee] px-3 py-2 text-xs"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></AdminFilterBar><AdminSectionCard title="Audit Events" subtitle={`${filtered.length} event${filtered.length === 1 ? '' : 's'}`}><div className="space-y-3"><div className="overflow-x-auto">{!filtered.length ? <AdminEmptyState icon={FileClock} title="No audit events found" /> : <table className="w-full min-w-[1400px] text-left text-xs"><thead><tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]"><th className="px-3 py-3">Date & Time</th><th>User</th><th>Role</th><th>Action</th><th>Entity Type</th><th>Village</th><th>Description</th><th>IP Address</th><th>Device / Browser</th><th className="text-right">Details</th></tr></thead><tbody className="divide-y divide-[#e2e8f0]">{paginatedLogs.map((log) => <tr key={log.id} className="hover:bg-[#f8fafc]"><td className="px-3 py-4">{new Date(log.created_at).toLocaleString()}</td><td className="font-bold">{log.profiles?.full_name || 'System'}</td><td>{log.profiles?.role || '-'}</td><td><span className="rounded-full bg-emerald-50 px-2 py-1 font-bold text-emerald-700">{log.action}</span></td><td>{log.entity_type}</td><td>{log.villages?.name || '-'}</td><td className="max-w-72 truncate">{log.description || '-'}</td><td>{log.ip_address || '-'}</td><td className="max-w-56 truncate">{log.user_agent || '-'}</td><td className="text-right"><button onClick={() => setSelected(log)} className="inline-flex items-center gap-1 rounded-lg border border-[#dbe4ee] px-3 py-2 font-bold"><Eye className="h-3 w-3" />View</button></td></tr>)}</tbody></table>}</div><Pagination currentPage={currentPage} totalItems={filtered.length} pageSize={AUDIT_PAGE_SIZE} onPageChange={setPage} itemLabel="audit events" /></div></AdminSectionCard></div>{selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#272727]/50 p-4 backdrop-blur-sm"><div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b p-5"><div><p className="text-xs font-extrabold uppercase text-emerald-600">Audit Event Details</p><h2 className="mt-1 text-xl font-extrabold">{selected.action}</h2></div><button onClick={() => setSelected(null)}><X /></button></div><div className="grid gap-4 p-5 sm:grid-cols-2">{[['User',selected.profiles?.full_name || 'System'],['Role',selected.profiles?.role || '-'],['Entity',`${selected.entity_type} / ${selected.entity_id || '-'}`],['Village',selected.villages?.name || '-'],['Timestamp',new Date(selected.created_at).toLocaleString()],['IP Address',selected.ip_address || '-'],['User Agent',selected.user_agent || '-'],['Description',selected.description || '-']].map(([label,value]) => <div key={label}><p className="text-xs font-bold text-[#64748b]">{label}</p><p className="mt-1 break-words text-sm font-bold text-[#272727]">{value}</p></div>)}<div className="sm:col-span-2"><p className="text-xs font-bold text-[#64748b]">Metadata</p><pre className="mt-2 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-emerald-300">{JSON.stringify(selected.metadata || {}, null, 2)}</pre></div></div></div></div>}</DashboardShell>;
}
