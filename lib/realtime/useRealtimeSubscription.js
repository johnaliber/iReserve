'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useRealtimeSubscription({
  channelName,
  subscriptions = [],
  enabled = true,
  onStatusChange
}) {
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState(enabled ? 'connecting' : 'disabled');
  const subscriptionsRef = useRef(subscriptions);
  const onStatusChangeRef = useRef(onStatusChange);
  const subscriptionKey = JSON.stringify(
    subscriptions.map(({ event = '*', schema = 'public', table, filter }) => ({
      event,
      schema,
      table,
      filter: filter || ''
    }))
  );

  useEffect(() => {
    subscriptionsRef.current = subscriptions;
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange, subscriptions]);

  useEffect(() => {
    const currentSubscriptions = subscriptionsRef.current;
    if (!enabled || !channelName || currentSubscriptions.length === 0) {
      return undefined;
    }

    let active = true;
    let channel = supabase.channel(channelName);

    currentSubscriptions.forEach((subscription, index) => {
      const {
        event = '*',
        schema = 'public',
        table,
        filter
      } = subscription;

      if (!table || typeof subscription.onChange !== 'function') return;

      channel = channel.on(
        'postgres_changes',
        {
          event,
          schema,
          table,
          ...(filter ? { filter } : {})
        },
        (payload) => {
          subscriptionsRef.current[index]?.onChange?.(payload);
        }
      );
    });

    channel.subscribe((nextStatus) => {
      if (!active) return;
      const normalized = nextStatus === 'SUBSCRIBED'
        ? 'connected'
        : nextStatus === 'CHANNEL_ERROR' || nextStatus === 'TIMED_OUT'
          ? 'error'
          : nextStatus === 'CLOSED'
            ? 'offline'
            : 'connecting';
      setStatus(normalized);
      onStatusChangeRef.current?.(normalized);
    });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [channelName, enabled, subscriptionKey, supabase]);

  return enabled ? status : 'disabled';
}
