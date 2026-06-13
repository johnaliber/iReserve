'use client';

import { useCallback, useEffect, useRef } from 'react';

export function useRealtimeRefresh(refresh, delay = 250) {
  const timerRef = useRef(null);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  return useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      refresh();
    }, delay);
  }, [delay, refresh]);
}
