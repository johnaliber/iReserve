import React from 'react';

export default function AdminPageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <header className="sticky top-0 z-10 -mx-2 flex flex-col gap-4 border-b border-[#e2e8f0] bg-[#f8fafc]/95 px-2 pb-5 pt-1 backdrop-blur md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-600">{eyebrow}</p>}
        <h1 className="mt-2 text-3xl font-extrabold text-[#272727]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm leading-6 text-[#64748b]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
