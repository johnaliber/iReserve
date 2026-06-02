'use client';

import React, { use, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

// Dynamically import the BlueprintEditor component to disable SSR for Konva browser compatibility
const BlueprintEditor = dynamic(
  () => import('@/components/editor/BlueprintEditor'),
  { ssr: false }
);

export default function ArchitectEditorPage({ params }) {
  // Unwrap parameters promise using standard React.use() hook
  const unwrappedParams = use(params);
  const blueprintId = unwrappedParams.id;
  
  const supabase = createClient();
  const [villageId, setVillageId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBlueprintMeta() {
      try {
        const { data, error } = await supabase
          .from('blueprints')
          .select('village_id')
          .eq('id', blueprintId)
          .single();

        if (!error && data) {
          setVillageId(data.village_id);
        }
      } catch (err) {
        console.error('Error loading blueprint scope:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchBlueprintMeta();
  }, [blueprintId, supabase]);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
        <span className="text-xs font-semibold uppercase tracking-wider">Mounting architect workspace...</span>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-950 overflow-hidden">
      <BlueprintEditor blueprintId={blueprintId} villageId={villageId} />
    </div>
  );
}
