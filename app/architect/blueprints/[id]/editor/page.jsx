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
      <div className="flex h-dvh w-screen flex-col items-center justify-center bg-[#f1f5f9] text-[#475569]">
        <Loader2 className="mb-3 h-8 w-8 animate-spin text-emerald-600" />
        <span className="text-xs font-semibold">Preparing architect workspace...</span>
      </div>
    );
  }

  return (
    <div className="h-dvh w-screen overflow-hidden bg-[#f1f5f9]">
      <BlueprintEditor blueprintId={blueprintId} villageId={villageId} />
    </div>
  );
}
