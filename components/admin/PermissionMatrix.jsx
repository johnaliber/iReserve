'use client';

import React from 'react';

export default function PermissionMatrix({ permissions, rolePermissionIds = [], overrides = {}, onOverrideChange, readOnly = false, checkboxMode = false }) {
  const groups = permissions.reduce((map, permission) => {
    map[permission.category] = [...(map[permission.category] || []), permission];
    return map;
  }, {});
  if (checkboxMode) {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        {Object.entries(groups).map(([category, items]) => (
          <section key={category} className="overflow-hidden rounded-xl border border-[#e1e7e4] bg-white">
            <div className="flex items-center justify-between border-b border-[#e8edeb] bg-[#f8faf9] px-4 py-2.5">
              <h3 className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#52635b]">{category}</h3>
              <span className="text-[10px] font-bold text-[#8b9992]">
                {items.filter((permission) => {
                  const inherited = rolePermissionIds.includes(permission.id);
                  const value = overrides[permission.id] || 'inherit';
                  return value === 'allow' || (value === 'inherit' && inherited);
                }).length}/{items.length}
              </span>
            </div>
            <div className="grid gap-px bg-[#edf1ef] sm:grid-cols-2">
              {items.map((permission) => {
                const inherited = rolePermissionIds.includes(permission.id);
                const value = overrides[permission.id] || 'inherit';
                const checked = value === 'allow' || (value === 'inherit' && inherited);
                return (
                  <label key={permission.id} className="flex min-h-14 cursor-pointer items-center gap-3 bg-white px-3 py-2.5 transition hover:bg-[#f5faf7]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        const nextChecked = event.target.checked;
                        const nextState = nextChecked === inherited ? 'inherit' : nextChecked ? 'allow' : 'deny';
                        onOverrideChange(permission.id, nextState);
                      }}
                      className="h-4 w-4 flex-shrink-0 accent-emerald-600"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-extrabold text-[#2d3b34]">{permission.display_name}</span>
                      <span className="block truncate font-mono text-[9px] text-[#7c8983]">{permission.name}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return <div className="space-y-5">{Object.entries(groups).map(([category, items]) => <div key={category} className="overflow-hidden rounded-xl border border-[#e2e8f0]"><div className="bg-[#f8fafc] px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-[#64748b]">{category}</div><div className="divide-y divide-[#e2e8f0]">{items.map((permission) => { const inherited = rolePermissionIds.includes(permission.id); const value = overrides[permission.id] || 'inherit'; const checked = value === 'allow' || (value === 'inherit' && inherited); return <div key={permission.id} className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_180px] md:items-center"><div><p className="text-sm font-extrabold text-[#272727]">{permission.display_name}</p><p className="text-xs font-mono text-emerald-700">{permission.name}</p><p className="mt-1 text-xs text-[#64748b]">{permission.description}</p></div><div>{readOnly ? <span className={`text-xs font-bold ${checked ? 'text-emerald-600' : 'text-[#94a3b8]'}`}>{checked ? 'Allowed' : 'Not granted'}</span> : <select value={value} onChange={(event) => onOverrideChange(permission.id, event.target.value)} className="w-full rounded-lg border border-[#dbe4ee] px-3 py-2 text-xs font-bold"><option value="inherit">Inherit ({inherited ? 'Allow' : 'Deny'})</option><option value="allow">Explicit Allow</option><option value="deny">Explicit Deny</option></select>}</div></div>; })}</div></div>)}</div>;
}
