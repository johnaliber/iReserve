import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function NextStepCard({ title, description, actionLabel, actionHref }) {
  return (
    <section className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">Your Next Step</p>
            <h2 className="mt-1 text-xl font-extrabold text-[#272727]">{title}</h2>
            <p className="mt-1 text-sm font-medium leading-6 text-[#475b52]">{description}</p>
          </div>
        </div>
        {actionHref && (
          <Link href={actionHref} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-extrabold text-white shadow-sm hover:bg-emerald-500">
            {actionLabel}<ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </section>
  );
}
