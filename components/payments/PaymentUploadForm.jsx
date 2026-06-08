'use client';

import { UploadCloud } from 'lucide-react';
import HelpText from '@/components/shared/HelpText';

const inputClass = 'mt-1.5 min-h-12 w-full rounded-xl border border-[#dbe4ee] bg-white px-4 text-sm text-[#272727] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15';

export default function PaymentUploadForm({
  paymentMethod,
  amount,
  referenceNumber,
  receipt,
  maximumAmount,
  onPaymentMethodChange,
  onAmountChange,
  onReferenceChange,
  onReceiptChange,
  onSubmit,
  submitting = false
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-lg font-extrabold text-[#272727]">Upload Receipt</h3>
        <p className="mt-1 text-sm text-[#64748b]">Enter the payment information shown on your receipt.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold text-[#475569]">
          Payment Method
          <select className={inputClass} value={paymentMethod} onChange={onPaymentMethodChange}>
            <option value="gcash">GCash</option>
            <option value="maya">Maya</option>
            <option value="bank_transfer">Bank Transfer</option>
          </select>
        </label>
        <label className="text-sm font-bold text-[#475569]">
          Payment Amount
          <input className={inputClass} type="number" min="0.01" max={maximumAmount} step="0.01" value={amount} onChange={onAmountChange} required />
        </label>
      </div>
      <label className="block text-sm font-bold text-[#475569]">
        Reference Number
        <input className={inputClass} value={referenceNumber} onChange={onReferenceChange} required />
      </label>
      <label className="block rounded-2xl border-2 border-dashed border-[#cbd5e1] bg-[#f8fafc] p-5 text-center">
        <UploadCloud className="mx-auto h-7 w-7 text-emerald-600" />
        <span className="mt-2 block text-sm font-extrabold text-[#272727]">{receipt?.name || 'Choose a clear receipt image'}</span>
        <span className="mt-1 block text-xs text-[#64748b]">JPG, PNG, or WebP</span>
        <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={onReceiptChange} required={!receipt} />
      </label>
      <HelpText>Please make sure the receipt is clear and the amount is correct before submitting.</HelpText>
      <button disabled={submitting} className="min-h-12 w-full rounded-xl bg-emerald-600 px-5 text-sm font-extrabold text-white hover:bg-emerald-500 disabled:opacity-60">
        {submitting ? 'Submitting...' : 'Review Receipt'}
      </button>
    </form>
  );
}
