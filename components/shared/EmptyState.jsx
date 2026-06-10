import Link from 'next/link';
import { Inbox } from 'lucide-react';

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  actionHref
}) {
  return (
    <div className="rounded-3xl border border-[#e2e8f0] bg-white px-6 py-12 text-center shadow-sm">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
        <Icon className="h-7 w-7" />
      </span>
      <h2 className="mt-4 text-xl font-extrabold text-[#272727]">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-[#475b52]">{description}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-500">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
