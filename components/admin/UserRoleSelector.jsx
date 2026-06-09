'use client';

import React from 'react';

export default function UserRoleSelector({ roles, value, onChange, disabled = false }) {
  return <select disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-[#dbe4ee] bg-white px-3 py-2.5 text-sm font-bold text-[#272727] outline-none focus:border-emerald-500 disabled:bg-slate-50">{roles.map((role) => <option key={role.name} value={role.name}>{role.display_name}</option>)}</select>;
}
