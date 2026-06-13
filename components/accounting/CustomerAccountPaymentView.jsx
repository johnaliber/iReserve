 'use client';

import PaymentSummaryCard from '@/components/payments/PaymentSummaryCard';

export default function CustomerAccountPaymentView({ plan }) {
  return <PaymentSummaryCard plan={plan} />;
}
