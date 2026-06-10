'use client';

import React from 'react';
import Link from 'next/link';
import AdminStatusBadge from './AdminStatusBadge';
import AdminEmptyState from './AdminEmptyState';
import AssignedVillagesCell from './AssignedVillagesCell';

export default function UserManagementTable({ users, basePath = '/super-admin/users' }) {
  if (!users.length) return <AdminEmptyState title="No users found" />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1050px] text-left text-sm">
        <thead>
          <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">
            <th className="px-4 py-3">Name</th>
            <th>Email</th>
            <th className="w-[112px] whitespace-nowrap px-2">Role</th>
            <th>Assigned Village/s</th>
            <th>Status</th>
            <th>Last Login</th>
            <th>Created Date</th>
            <th className="w-[92px] whitespace-nowrap pr-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e2e8f0]">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-[#f8fafc]">
              <td className="px-3 py-2.5 font-extrabold text-[#272727]">{user.full_name}</td>
              <td className="text-[#64748b]">{user.email}</td>
              <td className="w-[112px] whitespace-nowrap px-2">
                <span className="inline-flex whitespace-nowrap rounded-full bg-blue-50 px-2 py-1 text-[10px] font-extrabold uppercase leading-none text-blue-700">
                  {user.role?.replaceAll('_', ' ')}
                </span>
              </td>
              <td>
                <AssignedVillagesCell
                  villages={(user.scopes || [])
                    .filter((scope) => scope.scope_type === 'village')
                    .map((scope) => scope.villages)
                    .filter(Boolean)}
                  isGlobalAccess={user.scopes?.some((scope) => scope.scope_type === 'global')}
                  maxVisible={2}
                />
              </td>
              <td><AdminStatusBadge status={user.status} /></td>
              <td className="text-xs text-[#64748b]">
                {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}
              </td>
              <td className="text-xs text-[#64748b]">{new Date(user.created_at).toLocaleDateString()}</td>
              <td className="w-[92px] whitespace-nowrap pr-4 text-right">
                <div className="flex justify-end">
                  <Link href={`${basePath}/${user.id}`} className="rounded-lg border border-[#dbe4ee] px-3 py-2 text-xs font-bold text-[#64748b] hover:text-emerald-600">
                    View / Edit
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
