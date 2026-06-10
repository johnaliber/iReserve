import React from 'react';

export default function AdminPageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <header className="flex flex-col gap-3 border-b border-[#e2e8f0] bg-transparent pb-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">{eyebrow}</p>}
        <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-[#272727]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm leading-5 text-[#64748b]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
