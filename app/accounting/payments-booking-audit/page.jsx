import { redirect } from 'next/navigation';

export default function LegacyPaymentsBookingAuditPage() {
  redirect('/accounting/ledger/customer-accounts');
}
