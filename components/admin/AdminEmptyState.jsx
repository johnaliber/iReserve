import React from 'react';
import { Inbox } from 'lucide-react';

export default function AdminEmptyState({ title = 'No records found', description = 'Try adjusting your filters.', icon: Icon = Inbox }) {
  return <div className="py-12 text-center"><Icon className="mx-auto h-10 w-10 text-[#64748b]" /><p className="mt-3 font-extrabold text-[#33443c]">{title}</p><p className="mt-1 text-sm font-medium text-[#52635b]">{description}</p></div>;
}
