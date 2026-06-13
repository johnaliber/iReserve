'use client';

import { useCallback } from 'react';
import { useRealtimeTable } from './useRealtimeTable';

export function useRealtimeChatMessages({ conversationId, onNewMessage, enabled = true }) {
  const handleChange = useCallback((payload) => {
    if (payload.eventType === 'INSERT') onNewMessage?.(payload.new, payload);
  }, [onNewMessage]);

  return useRealtimeTable({
    table: 'conversation_messages',
    filter: conversationId ? `conversation_id=eq.${conversationId}` : undefined,
    event: 'INSERT',
    onChange: handleChange,
    enabled: enabled && Boolean(conversationId)
  });
}

export const useRealtimeChat = useRealtimeChatMessages;
