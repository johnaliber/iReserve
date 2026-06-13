'use client';

import { useCallback } from 'react';
import { useRealtimeTable } from './useRealtimeTable';

export function useRealtimeVillage({ table, villageId, event = '*', onChange, enabled = true }) {
  const handleChange = useCallback((payload) => {
    onChange?.(payload);
  }, [onChange]);

  return useRealtimeTable({
    table,
    filter: villageId ? `village_id=eq.${villageId}` : undefined,
    event,
    onChange: handleChange,
    enabled: enabled && Boolean(villageId)
  });
}

export function useRealtimeProperties({ villageId, onPropertyChange, enabled = true }) {
  return useRealtimeVillage({
    table: 'properties',
    villageId,
    onChange: onPropertyChange,
    enabled
  });
}
