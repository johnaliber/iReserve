import { CircleHelp } from 'lucide-react';

export default function HelpText({ children }) {
  return (
    <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium leading-5 text-emerald-900">
      <CircleHelp className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
