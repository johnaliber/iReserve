'use client';

import React from 'react';
import Link from 'next/link';
import AdminSidebarDropdown from './AdminSidebarDropdown';

export default function AdminSidebarNav({
  items,
  pathname,
  roleFilter,
  collapsed,
  onNavigate,
  onRoleFilterChange
}) {
  const isRouteActive = (item) => {
    if (item.match) return item.match(pathname);
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  const isChildActive = (item) => {
    if (item.roleFilter !== undefined) {
      return pathname === '/super-admin/users' && roleFilter === item.roleFilter;
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        if (item.children) {
          const parentActive = item.children.some(isChildActive) || item.match?.(pathname);
          return (
            <AdminSidebarDropdown
              key={item.title}
              item={item}
              collapsed={collapsed}
              parentActive={parentActive}
              isChildActive={isChildActive}
              onNavigate={(child) => {
                if (child.roleFilter !== undefined) onRoleFilterChange(child.roleFilter);
                onNavigate();
              }}
            />
          );
        }

        const Icon = item.icon;
        const active = isRouteActive(item);
        return (
          <Link
            key={item.title}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.title : undefined}
            className={`relative flex h-10 items-center rounded-lg text-sm font-bold transition ${
              collapsed
                ? 'z-20 mx-auto w-10 shrink-0 justify-center overflow-visible border border-transparent bg-white px-0'
                : 'w-full gap-3 border-b-2 px-3'
            } ${
              active
                ? collapsed
                  ? 'border-[#bbf7d0] bg-[#ecfdf5] text-[#166534] shadow-sm'
                  : 'border-[#16835f] bg-transparent text-[#166534]'
                : collapsed
                  ? 'text-[#33443c] hover:border-[#e2e8f0] hover:bg-[#f1f5f3] hover:text-[#17211d]'
                  : 'border-transparent text-[#33443c] hover:bg-[#f1f5f3] hover:text-[#17211d]'
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.title}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
