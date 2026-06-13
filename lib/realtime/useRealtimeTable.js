'use client';

import { useMemo } from 'react';
import { useRealtimeSubscription } from './useRealtimeSubscription';

function safeChannelPart(value) {
  return String(value || 'all').replace(/[^a-z0-9:_-]/gi, '-');
}

export function useRealtimeTable({
  table,
  filter,
  event = '*',
  onChange,
  enabled = true,
  channelKey,
  onStatusChange
}) {
  const subscriptions = useMemo(() => [{
    event,
    schema: 'public',
    table,
    filter,
    onChange
  }], [event, filter, onChange, table]);

  return useRealtimeSubscription({
    channelName: `realtime:${safeChannelPart(table)}:${safeChannelPart(channelKey || filter)}`,
    subscriptions,
    enabled: enabled && Boolean(table) && typeof onChange === 'function',
    onStatusChange
  });
}
