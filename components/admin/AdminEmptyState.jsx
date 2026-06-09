import React from 'react';
import { Inbox } from 'lucide-react';

export default function AdminEmptyState({ title = 'No records found', description = 'Try adjusting your filters.', icon: Icon = Inbox }) {
  return <div className="py-12 text-center"><Icon className="mx-auto h-10 w-10 text-[#cbd5e1]" /><p className="mt-3 font-extrabold text-[#64748b]">{title}</p><p className="mt-1 text-sm text-[#94a3b8]">{description}</p></div>;
}
