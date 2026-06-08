import { AlertCircle } from 'lucide-react';

export default function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center">
      <AlertCircle className="mx-auto h-7 w-7 text-rose-600" />
      <h2 className="mt-3 font-extrabold text-rose-900">{title}</h2>
      <p className="mt-1 text-sm text-rose-700">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-4 min-h-11 rounded-xl bg-rose-600 px-4 text-sm font-bold text-white">
          Try Again
        </button>
      )}
    </div>
  );
}
