'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export default function AdminSidebarDropdown({
  item,
  collapsed,
  parentActive,
  isChildActive,
  onNavigate
}) {
  const [open, setOpen] = useState(parentActive);
  const containerRef = useRef(null);
  const Icon = item.icon;

  useEffect(() => {
    if (!collapsed || !open) return undefined;

    const close = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [collapsed, open]);

  const expanded = open || (!collapsed && parentActive);

  return (
    <div ref={containerRef} className="relative overflow-visible">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        title={collapsed ? item.title : undefined}
        aria-expanded={expanded}
        className={`relative flex h-10 items-center rounded-lg text-sm font-bold transition ${
          collapsed
            ? 'z-20 mx-auto w-10 shrink-0 justify-center overflow-visible border border-transparent bg-white px-0'
            : 'w-full gap-3 border-b-2 px-3'
        } ${
          parentActive
            ? collapsed
              ? 'border-[#bbf7d0] bg-[#ecfdf5] text-[#166534] shadow-sm'
              : 'border-[#16835f] bg-transparent text-[#166534]'
            : collapsed
              ? 'text-[#33443c] hover:border-[#e2e8f0] hover:bg-[#f1f5f3] hover:text-[#17211d]'
              : 'border-transparent text-[#33443c] hover:bg-[#f1f5f3] hover:text-[#17211d]'
        }`}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{item.title}</span>
            <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
          </>
        )}
      </button>

      {!collapsed && expanded && (
        <div className="ml-[21px] mt-1 space-y-0.5 border-l border-[#dbe4ee] pl-3">
          {item.children.map((child) => {
            const ChildIcon = child.icon;
            const active = isChildActive(child);
            return (
              <Link
                key={child.title}
                href={child.href}
                onClick={() => onNavigate(child)}
                className={`flex min-h-9 items-center gap-2 rounded-md border-b-2 px-2.5 py-1.5 text-sm font-semibold transition ${
                  active
                    ? 'border-[#16835f] bg-transparent text-[#166534]'
                    : 'border-transparent text-[#475b52] hover:bg-[#f1f5f3] hover:text-[#17211d]'
                }`}
              >
                <ChildIcon className="h-4 w-4 shrink-0" />
                <span>{child.title}</span>
              </Link>
            );
          })}
        </div>
      )}

      {collapsed && expanded && (
        <div className="absolute left-[calc(100%+10px)] top-0 z-50 w-60 rounded-xl border border-[#dbe4ee] bg-white p-2 shadow-[0_16px_45px_rgba(15,23,42,0.14)]">
          <p className="px-2 py-1.5 text-xs font-extrabold uppercase tracking-wider text-[#52635b]">{item.title}</p>
          {item.children.map((child) => {
            const ChildIcon = child.icon;
            const active = isChildActive(child);
            return (
              <Link
                key={child.title}
                href={child.href}
                onClick={() => {
                  setOpen(false);
                  onNavigate(child);
                }}
                className={`flex min-h-9 items-center gap-2 rounded-md border-b-2 px-2.5 text-sm font-semibold transition ${
                  active
                    ? 'border-[#16835f] bg-transparent text-[#166534]'
                    : 'border-transparent text-[#475b52] hover:bg-[#f1f5f3] hover:text-[#17211d]'
                }`}
              >
                <ChildIcon className="h-4 w-4" />
                {child.title}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
