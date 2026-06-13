'use client';

import { useMemo } from 'react';
import { useRealtimeSubscription } from './useRealtimeSubscription';

export function useRealtimeBlueprint({
  blueprintId,
  villageId,
  onBlueprintChange,
  onObjectChange,
  enabled = true
}) {
  const subscriptions = useMemo(() => {
    const items = [];
    if (blueprintId) {
      items.push({
        event: '*',
        schema: 'public',
        table: 'blueprints',
        filter: `id=eq.${blueprintId}`,
        onChange: onBlueprintChange
      });
      items.push({
        event: '*',
        schema: 'public',
        table: 'blueprint_objects',
        filter: `blueprint_id=eq.${blueprintId}`,
        onChange: onObjectChange
      });
    } else if (villageId) {
      items.push({
        event: '*',
        schema: 'public',
        table: 'blueprints',
        filter: `village_id=eq.${villageId}`,
        onChange: onBlueprintChange
      });
      items.push({
        event: '*',
        schema: 'public',
        table: 'blueprint_objects',
        filter: `village_id=eq.${villageId}`,
        onChange: onObjectChange
      });
    }
    return items.filter((item) => typeof item.onChange === 'function');
  }, [blueprintId, onBlueprintChange, onObjectChange, villageId]);

  return useRealtimeSubscription({
    channelName: `realtime:blueprint:${blueprintId || villageId || 'disabled'}`,
    subscriptions,
    enabled: enabled && Boolean(blueprintId || villageId)
  });
}
