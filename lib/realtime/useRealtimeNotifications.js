'use client';

import { useCallback } from 'react';
import { useRealtimeTable } from './useRealtimeTable';

export function useRealtimeNotifications({ userId, onNotification, enabled = true }) {
  const handleChange = useCallback((payload) => {
    onNotification?.(payload);
  }, [onNotification]);

  return useRealtimeTable({
    table: 'notifications',
    filter: userId ? `user_id=eq.${userId}` : undefined,
    onChange: handleChange,
    enabled: enabled && Boolean(userId)
  });
}
