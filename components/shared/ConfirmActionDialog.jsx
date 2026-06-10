'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmActionDialog({
  open,
  title,
  message,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  destructive = false,
  busy = false,
  onCancel,
  onConfirm
}) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    confirmRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onCancel?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0f172a]/65 p-4 backdrop-blur-sm" onMouseDown={() => !busy && onCancel?.()}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="w-full max-w-sm rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className={`rounded-full p-2 ${destructive ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-dialog-title" className="text-lg font-extrabold text-[#272727]">{title}</h2>
            <p id="confirm-dialog-description" className="mt-1.5 text-sm leading-5 text-[#64748b]">{message}</p>
          </div>
          <button type="button" aria-label="Close dialog" onClick={onCancel} disabled={busy} className="rounded-full p-1.5 text-[#64748b] hover:bg-[#f1f5f9]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={busy} className="min-h-10 rounded-xl border border-[#dbe4ee] bg-white px-4 text-sm font-bold text-[#272727] hover:bg-[#f8fafc] disabled:opacity-60">
            {cancelLabel}
          </button>
          <button ref={confirmRef} type="button" onClick={onConfirm} disabled={busy} className={`min-h-10 rounded-xl px-4 text-sm font-extrabold text-white disabled:opacity-60 ${destructive ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
            {busy ? 'Please wait...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
