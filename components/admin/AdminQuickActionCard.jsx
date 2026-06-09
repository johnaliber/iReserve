import React from 'react';
import Link from 'next/link';

export default function AdminQuickActionCard({ icon: Icon, title, description, href, label = 'Open' }) {
  return <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm"><Icon className="h-6 w-6 text-emerald-600" /><h3 className="mt-4 font-extrabold text-[#272727]">{title}</h3><p className="mt-1 min-h-10 text-sm text-[#64748b]">{description}</p><Link href={href} className="mt-4 inline-flex rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-emerald-500">{label}</Link></div>;
}
