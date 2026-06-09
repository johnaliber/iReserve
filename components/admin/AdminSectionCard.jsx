import React from 'react';

export default function AdminSectionCard({ title, subtitle, actions, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-[#e2e8f0] bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="flex flex-col gap-3 border-b border-[#e2e8f0] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title && <h2 className="text-lg font-extrabold text-[#272727]">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm text-[#64748b]">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
