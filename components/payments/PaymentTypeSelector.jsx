'use client';

import React from 'react';
import { CreditCard, Landmark, WalletCards } from 'lucide-react';
import { PAYMENT_TYPES } from '@/lib/payments/paymentMath';

const icons = {
  full_payment: Landmark,
  partial_payment: WalletCards,
  installment: CreditCard
};

export default function PaymentTypeSelector({ value, onChange }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {Object.entries(PAYMENT_TYPES).map(([type, label]) => {
        const Icon = icons[type];
        const active = value === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={`rounded-xl border p-4 text-left transition ${
              active
                ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                : 'border-[#e2e8f0] bg-white text-[#272727] hover:border-emerald-200'
            }`}
          >
            <Icon className="mb-3 h-5 w-5" />
            <span className="block text-sm font-extrabold">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
