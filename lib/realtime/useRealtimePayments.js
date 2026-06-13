'use client';

import { useCallback } from 'react';
import { useRealtimeTable } from './useRealtimeTable';

export function useRealtimePayments({
  customerId,
  villageId,
  reservationId,
  onPaymentChange,
  enabled = true
}) {
  const handleChange = useCallback((payload) => {
    onPaymentChange?.(payload);
  }, [onPaymentChange]);
  const filter = reservationId
    ? `reservation_id=eq.${reservationId}`
    : customerId
      ? `customer_id=eq.${customerId}`
      : villageId
        ? `village_id=eq.${villageId}`
        : undefined;

  return useRealtimeTable({
    table: 'payments',
    filter,
    onChange: handleChange,
    enabled: enabled && Boolean(filter)
  });
}
