'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Filter, Plus, Search, ShieldCheck, UserCheck, Users, UserX } from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import Pagination from '@/components/shared/Pagination';
import AdminPageHeader from './AdminPageHeader';
import AdminStatsCard from './AdminStatsCard';
import AdminFilterBar from './AdminFilterBar';
import AdminSectionCard from './AdminSectionCard';
import UserManagementTable from './UserManagementTable';
import UserFormDialog from './UserFormDialog';

const USERS_PAGE_SIZE = 10;
const ROLE_PAGE_COPY = {
  '': { title: 'Users', subtitle: 'Showing all system users' },
  super_admin: { title: 'Super Admins', subtitle: 'Showing super admin users' },
  village_admin: { title: 'Village Admins', subtitle: 'Showing village admin users' },
  accounting: { title: 'Accounting Users', subtitle: 'Showing accounting users' },
  architect: { title: 'Architects', subtitle: 'Showing architect users' },
  customer: { title: 'Customers', subtitle: 'Showing customer users' },
  guest: { title: 'Guests', subtitle: 'Showing guest users' }
};

export default function UserManagementPage({ villageMode = false, initialRoleFilter = '' }) {
  const basePath = villageMode ? '/village-admin/users' : '/super-admin/users';
  const [data, setData] = useState({ users: [], villages: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [filters, setFilters] = useState({ search: '', role: initialRoleFilter, village: '', status: '' });
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch('/api/admin/users');
    const payload = await response.json();
    if (response.ok) setData(payload);
    else setError(payload.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const users = useMemo(() => data.users.filter((user) => {
    const text = `${user.full_name} ${user.email}`.toLowerCase();
    if (filters.search && !text.includes(filters.search.toLowerCase())) return false;
    if (filters.role && user.role !== filters.role) return false;
    if (filters.status && user.status !== filters.status) return false;
    if (filters.village && !user.scopes?.some((scope) => scope.village_id === filters.village)) return false;
    return true;
  }), [data.users, filters]);

  const totalPages = Math.max(1, Math.ceil(users.length / USERS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedUsers = users.slice(
    (currentPage - 1) * USERS_PAGE_SIZE,
    currentPage * USERS_PAGE_SIZE
  );
  const active = data.users.filter((user) => user.status === 'active').length;
  const suspended = data.users.filter((user) => user.status === 'suspended').length;
  const pageCopy = villageMode
    ? { title: 'User Management', subtitle: 'View and manage users within your assigned village access.' }
    : ROLE_PAGE_COPY[filters.role] || ROLE_PAGE_COPY[''];

  return (
    <DashboardShell>
      <div className="mx-auto max-w-[1600px] space-y-6">
        <AdminPageHeader
          eyebrow={villageMode ? 'Assigned Village Access' : 'System Administration'}
          title={pageCopy.title}
          subtitle={pageCopy.subtitle}
          actions={!villageMode && (
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-extrabold text-white"
            >
              <Plus className="h-4 w-4" />
              Create User
            </button>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminStatsCard label="Total Users" value={data.users.length} icon={Users} />
          <AdminStatsCard label="Active Accounts" value={active} icon={UserCheck} tone="blue" />
          <AdminStatsCard label="Suspended" value={suspended} icon={UserX} tone="red" />
          <AdminStatsCard label="Roles In Use" value={new Set(data.users.map((user) => user.role)).size} icon={ShieldCheck} tone="purple" />
        </div>

        <AdminFilterBar>
          <Filter className="h-4 w-4 text-emerald-600" />
          <div className="relative min-w-60 flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94a3b8]" />
            <input
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Search name or email"
              className="w-full rounded-xl border border-[#dbe4ee] py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <select
            value={filters.role}
            onChange={(event) => updateFilter('role', event.target.value)}
            className="rounded-xl border border-[#dbe4ee] px-3 py-2 text-sm"
          >
            <option value="">All roles</option>
            {['super_admin', 'village_admin', 'accounting', 'architect', 'customer', 'guest'].map((role) => (
              <option key={role} value={role}>{role.replaceAll('_', ' ')}</option>
            ))}
          </select>
          <select
            value={filters.village}
            onChange={(event) => updateFilter('village', event.target.value)}
            className="rounded-xl border border-[#dbe4ee] px-3 py-2 text-sm"
          >
            <option value="">All villages</option>
            {data.villages.map((village) => (
              <option key={village.id} value={village.id}>{village.name}</option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(event) => updateFilter('status', event.target.value)}
            className="rounded-xl border border-[#dbe4ee] px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </AdminFilterBar>

        <AdminSectionCard title="Users" subtitle={`${users.length} matching account${users.length === 1 ? '' : 's'}`}>
          {loading ? (
            <p className="py-12 text-center text-[#64748b]">Loading users...</p>
          ) : error ? (
            <p className="rounded-xl bg-red-50 p-4 text-red-600">{error}</p>
          ) : (
            <div className="space-y-3">
              <UserManagementTable users={paginatedUsers} basePath={basePath} />
              <Pagination
                currentPage={currentPage}
                totalItems={users.length}
                pageSize={USERS_PAGE_SIZE}
                onPageChange={setPage}
                itemLabel="users"
              />
            </div>
          )}
        </AdminSectionCard>
      </div>

      <UserFormDialog
        open={createOpen}
        villages={data.villages}
        onClose={() => setCreateOpen(false)}
        onCreated={load}
      />
    </DashboardShell>
  );
}
