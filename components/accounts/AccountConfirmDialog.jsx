'use client';

import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

export default function AccountConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'emerald',
  loading = false,
  onCancel,
  onConfirm
}) {
  if (!open) return null;

  const destructive = tone === 'danger';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#272727]/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-[#e2e8f0] bg-white p-4 text-center shadow-2xl">
        <div className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border ${
          destructive
            ? 'border-red-100 bg-red-50 text-red-500'
            : 'border-amber-100 bg-amber-50 text-amber-600'
        }`}>
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 className="text-lg font-extrabold text-[#272727]">{title}</h3>
        <div className="mt-2 text-xs leading-relaxed text-[#64748b]">{description}</div>
        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-[#dbe4ee] bg-white px-5 py-2.5 text-xs font-bold text-[#64748b] transition hover:bg-[#f8fafc] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-xs font-extrabold text-white shadow-sm transition disabled:opacity-60 ${
              destructive ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
