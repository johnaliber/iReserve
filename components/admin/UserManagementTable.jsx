'use client';

import React from 'react';
import Link from 'next/link';
import AdminStatusBadge from './AdminStatusBadge';
import AdminEmptyState from './AdminEmptyState';

export default function UserManagementTable({ users, basePath = '/super-admin/users' }) {
  if (!users.length) return <AdminEmptyState title="No users found" />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1050px] text-left text-sm">
        <thead>
          <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">
            <th className="px-4 py-3">Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Assigned Village/s</th>
            <th>Status</th>
            <th>Last Login</th>
            <th>Created Date</th>
            <th className="pr-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e2e8f0]">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-[#f8fafc]">
              <td className="px-4 py-4 font-extrabold text-[#272727]">{user.full_name}</td>
              <td className="text-[#64748b]">{user.email}</td>
              <td>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-extrabold uppercase text-blue-700">
                  {user.role?.replaceAll('_', ' ')}
                </span>
              </td>
              <td>
                <div className="flex max-w-64 flex-wrap gap-1">
                  {user.scopes?.filter((scope) => scope.scope_type === 'village').map((scope) => (
                    <span key={scope.id} className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                      {scope.villages?.name || 'Village'}
                    </span>
                  ))}
                  {user.scopes?.some((scope) => scope.scope_type === 'global') && (
                    <span className="text-xs font-bold text-purple-600">Global access</span>
                  )}
                  {!user.scopes?.length && <span className="text-xs text-[#94a3b8]">Unassigned</span>}
                </div>
              </td>
              <td><AdminStatusBadge status={user.status} /></td>
              <td className="text-xs text-[#64748b]">
                {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}
              </td>
              <td className="text-xs text-[#64748b]">{new Date(user.created_at).toLocaleDateString()}</td>
              <td className="pr-4 text-right">
                <div className="flex justify-end gap-2">
                  <Link href={`${basePath}/${user.id}`} className="rounded-lg border border-[#dbe4ee] px-3 py-2 text-xs font-bold text-[#64748b] hover:text-emerald-600">
                    View / Edit
                  </Link>
                  <Link href={`${basePath}/${user.id}?tab=activity`} className="rounded-lg bg-[#f8fafc] px-3 py-2 text-xs font-bold text-[#64748b]">
                    Audit Logs
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
