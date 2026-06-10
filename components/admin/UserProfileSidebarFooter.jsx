'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, ChevronUp, LogOut, Settings, UserRound } from 'lucide-react';

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U';
}

export default function UserProfileSidebarFooter({
  profile,
  collapsed,
  settingsHref,
  notificationsHref,
  onNotifications,
  onLogout
}) {
  const [open, setOpen] = useState(false);
  const footerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!footerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (!profile) return null;

  return (
    <div ref={footerRef} className={`relative z-10 overflow-visible ${collapsed ? 'py-2' : 'border-t border-[#e2e8f0] p-2'}`}>
      {open && (
        <div className={`absolute bottom-[calc(100%+8px)] z-50 w-60 rounded-xl border border-[#dbe4ee] bg-white p-1.5 shadow-[0_16px_45px_rgba(15,23,42,0.14)] ${
          collapsed ? 'left-[calc(100%+10px)]' : 'left-2'
        }`}>
          <div className="border-b border-[#edf1ef] px-2.5 py-2">
            <p className="truncate text-sm font-extrabold text-[#17211d]">{profile.full_name}</p>
            <p className="truncate text-xs text-[#5f7068]">{profile.email}</p>
            <p className="mt-1 text-[10px] font-extrabold uppercase tracking-wider text-[#16835f]">
              {profile.role?.replaceAll('_', ' ')}
            </p>
          </div>
          <Link href={settingsHref} onClick={() => setOpen(false)} className="mt-1 flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-semibold text-[#33443c] hover:bg-[#f1f5f3]">
            <UserRound className="h-4 w-4" />
            Account
          </Link>
          {notificationsHref && (
            <Link href={notificationsHref} onClick={() => setOpen(false)} className="flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-semibold text-[#33443c] hover:bg-[#f1f5f3]">
              <Bell className="h-4 w-4" />
              Notifications
            </Link>
          )}
          {!notificationsHref && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onNotifications();
              }}
              className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-sm font-semibold text-[#33443c] hover:bg-[#f1f5f3]"
            >
              <Bell className="h-4 w-4" />
              Notifications
            </button>
          )}
          <Link href={settingsHref} onClick={() => setOpen(false)} className="flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-semibold text-[#33443c] hover:bg-[#f1f5f3]">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          <div className="my-1 border-t border-[#edf1ef]" />
          <button type="button" onClick={onLogout} className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-sm font-semibold text-[#991b1b] hover:bg-[#fff1f2]">
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        title={collapsed ? `${profile.full_name} account menu` : undefined}
        aria-expanded={open}
        className={`flex items-center rounded-xl transition hover:bg-[#f1f5f3] ${
          collapsed
            ? 'relative z-20 mx-auto h-10 w-10 shrink-0 justify-center overflow-visible border border-[#dbe4ee] bg-white p-0 shadow-sm'
            : 'w-full gap-2.5 p-2'
        }`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e8f7f1] text-xs font-extrabold text-[#166534]">
          {initials(profile.full_name)}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-extrabold text-[#17211d]">{profile.full_name}</span>
              <span className="block truncate text-[11px] font-medium text-[#5f7068]">{profile.email}</span>
            </span>
            <ChevronUp className={`h-4 w-4 text-[#5f7068] transition-transform ${open ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>
    </div>
  );
}
