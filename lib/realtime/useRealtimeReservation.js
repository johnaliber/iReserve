'use client';

import { useCallback } from 'react';
import { useRealtimeTable } from './useRealtimeTable';

export function useRealtimeReservation({
  customerId,
  villageId,
  reservationId,
  onReservationChange,
  enabled = true
}) {
  const handleChange = useCallback((payload) => {
    onReservationChange?.(payload);
  }, [onReservationChange]);
  const filter = reservationId
    ? `id=eq.${reservationId}`
    : customerId
      ? `customer_id=eq.${customerId}`
      : villageId
        ? `village_id=eq.${villageId}`
        : undefined;

  return useRealtimeTable({
    table: 'reservations',
    filter,
    onChange: handleChange,
    enabled: enabled && Boolean(filter)
  });
}
