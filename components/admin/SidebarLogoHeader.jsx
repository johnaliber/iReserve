'use client';

import React from 'react';
import BrandLogo from '@/components/brand/BrandLogo';

export default function SidebarLogoHeader({ collapsed }) {
  return (
    <div className={`relative z-20 flex h-16 items-center overflow-visible border-b border-[#e2e8f0] ${
      collapsed ? 'justify-start px-2' : 'gap-3'
    }`}>
      <BrandLogo
        compact
        className={collapsed ? '!h-10 !w-12 shrink-0' : 'ml-3 !h-9 !w-10 shrink-0'}
      />
      {!collapsed && (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-[#17211d]">iReserve</p>
          <p className="truncate text-[10px] font-semibold text-[#5f7068]">Smart Village Reservation</p>
        </div>
      )}
    </div>
  );
}
