'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/layout/Navbar';
import { Building, MapPin, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

const InteractiveVillageMap = dynamic(() => import('@/components/public/InteractiveVillageMap'), { ssr: false });

export default function VillageMapPage({ params }) {
  const resolvedParams = React.use(params);
  const slug = resolvedParams.slug;
  
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [village, setVillage] = useState(null);

  const fetchVillage = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('villages')
        .select('*')
        .eq('slug', slug)
        .single();

      if (data) {
        setVillage(data);
      }
    } catch (error) {
      console.error('Error fetching village for map page:', error);
    } finally {
      setLoading(false);
    }
  }, [slug, supabase]);

  useEffect(() => {
    if (slug) {
      const timer = setTimeout(() => {
        fetchVillage();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [slug, fetchVillage]);

  const villageName = village?.name || 'Smart Subdivision';
  const villageLocation = village ? `${village.city}, ${village.province}` : 'Tagaytay City';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-hidden">
      {/* 1. Header Navbar */}
      <Navbar />

      {/* 2. Page Navigation and title */}
      <div className="bg-slate-900/60 border-b border-slate-900 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 select-none z-10 glass-card">
        <div className="flex items-center gap-3">
          <Link
            href={`/villages/${slug}`}
            className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition outline-none cursor-pointer"
            title="Back to Landing Page"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Subdivision Blueprint View</span>
            <h1 className="text-xl font-bold text-white mt-0.5 flex items-center gap-1.5">
              <Building className="w-5 h-5 text-emerald-400" />
              {villageName} Map
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
          <MapPin className="w-4 h-4 text-emerald-400" />
          <span>{villageLocation}</span>
        </div>
      </div>

      {/* 3. Stage viewport */}
      <main className="flex-1 flex flex-col relative z-10 p-6 max-w-7xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center min-h-[500px] text-slate-400">
            <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
          </div>
        ) : (
          <InteractiveVillageMap villageSlug={slug} allowDemoFallback={false} />
        )}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/30 py-4 text-center text-xs text-slate-600">
        <p>© {new Date().getFullYear()} iReserve Smart Map Viewer. All rights reserved.</p>
      </footer>
    </div>
  );
}
