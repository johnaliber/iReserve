import React from 'react';
import { createClient } from '@/lib/supabase/server';
import VillageCard from '@/components/public/VillageCard';
import Navbar from '@/components/layout/Navbar';
import { Map, ShieldAlert, Sparkles, Navigation, Layers, Compass, HelpCircle } from 'lucide-react';
import Link from 'next/link';

// Enable dynamic rendering
export const revalidate = 0;

export default async function HomePage() {
  let villages = [];
  let error = null;

  try {
    const supabase = await createClient();
    const { data, error: dbError } = await supabase
      .from('villages')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (dbError) throw dbError;
    villages = data || [];
  } catch (err) {
    console.error('Error fetching villages on homepage:', err);
    error = err;
  }

  // Pre-configured mock villages for immediate visualization if database is empty
  const mockVillages = [
    {
      id: 'mock-1',
      name: 'Emerald Ridge Heights',
      slug: 'emerald-ridge',
      description: 'A luxurious eco-friendly smart subdivision sitting on a gentle ridge. Features solar lighting, automated security gates, large private pools, and beautiful natural pine tree trails.',
      address: 'KM 54 Ridge Highway',
      city: 'Tagaytay',
      province: 'Cavite',
      starting_price: 4500000,
      hero_image_url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
      properties_count: 24,
      available_count: 12
    },
    {
      id: 'mock-2',
      name: 'Teal Lagoon Residences',
      slug: 'teal-lagoon',
      description: 'A beautiful waterfront village centered around a crystal clear recreational lake. Boasts a sprawling yacht club, tennis courts, sand volleyball, and robust fiber optic internet.',
      address: 'Lagoon Circle Drive',
      city: 'Calamba',
      province: 'Laguna',
      starting_price: 3800000,
      hero_image_url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
      properties_count: 18,
      available_count: 8
    }
  ];

  const displayedVillages = villages.length > 0 ? villages : mockVillages;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-hidden">
      {/* Decorative gradient glowing spheres */}
      <div className="absolute top-[-20%] right-[-10%] w-[1000px] h-[1000px] rounded-full bg-emerald-950/10 blur-[180px] pointer-events-none animate-pulse-slow" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[800px] h-[800px] rounded-full bg-teal-950/10 blur-[150px] pointer-events-none" />

      {/* Global navbar header */}
      <Navbar />

      {/* 1. Hero Section */}
      <section className="relative pt-20 pb-16 px-4 md:px-8 max-w-7xl mx-auto text-center z-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-6 select-none shadow">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Next-Generation Subdivision Reservations</span>
        </div>
        
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 max-w-4xl mx-auto leading-tight">
          Don&apos;t just browse cards.{' '}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 bg-clip-text text-transparent">
            Walk the subdivision map.
          </span>
        </h1>
        
        <p className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed mb-8">
          iReserve is an interactive, blueprint-driven reservation system. Open a village subdivision map, toggle sunlight exposure, flood risks, and amenities, click a lot, and secure your reservation in 48 hours.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="#explore-villages"
            className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/15 transition duration-200 transform hover:scale-[1.02] cursor-pointer"
          >
            Explore Interactive Villages
          </Link>
          <Link
            href="/auth/register"
            className="w-full sm:w-auto px-8 py-3.5 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/40 text-slate-200 font-semibold rounded-xl transition duration-200 cursor-pointer"
          >
            Create an Account
          </Link>
        </div>

        {/* Dynamic Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 p-6 rounded-2xl glass-card border border-slate-900/80">
          <div>
            <span className="block text-3xl font-extrabold text-white">100%</span>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1 block">Vector Map Editor</span>
          </div>
          <div className="border-l border-slate-800/80">
            <span className="block text-3xl font-extrabold text-white">48hr</span>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1 block">Unpaid Expiration</span>
          </div>
          <div className="border-l border-slate-800/80">
            <span className="block text-3xl font-extrabold text-white">GCash/Maya</span>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1 block">Manual Receipt uploads</span>
          </div>
          <div className="border-l border-slate-800/80">
            <span className="block text-3xl font-extrabold text-white">Realtime</span>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1 block">Role Dashboards</span>
          </div>
        </div>
      </section>

      {/* 2. Interactive Features Highlights */}
      <section className="py-16 px-4 md:px-8 border-y border-slate-900 bg-slate-900/20 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">Engineered for Transparency</h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              Our vector map editor allows architects to sketch subdivision paths. You see exactly what you buy.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="glass-card p-6 rounded-xl border border-slate-800/80">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 shadow">
                <Navigation className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-200 mb-2">Automated Snapping Roads</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Architects can design streets using vector tools that auto-align and merge visually at intersections.
              </p>
            </div>

            <div className="glass-card p-6 rounded-xl border border-slate-800/80">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 shadow">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-200 mb-2">Environmental Map Layers</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Toggle overlay filters for morning/afternoon sunlight orientations, flood hazards, guard house distances, and clubhouses.
              </p>
            </div>

            <div className="glass-card p-6 rounded-xl border border-slate-800/80">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 shadow">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-200 mb-2">Smart Recommendation Filters</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Input your budget, preferred rooms, parking requirements, and sunlight specs to find optimized coordinates matching your profile.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Subdivisions Showcase */}
      <section id="explore-villages" className="py-16 px-4 md:px-8 max-w-7xl mx-auto w-full relative z-10 flex-1">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-white">Active Subdivision Portals</h2>
            <p className="text-slate-400 text-sm mt-1">
              Select a village to inspect the vector blueprints and start reserving lots.
            </p>
          </div>
          {villages.length === 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2 text-amber-400 text-xs flex items-center gap-1.5 self-start select-none">
              <ShieldAlert className="w-4 h-4" />
              <span>Demo Mode: Displaying sample templates. Log in to add active records!</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayedVillages.map((village) => (
            <VillageCard key={village.id} village={village} />
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 px-4 py-6 text-center text-xs text-slate-500 z-10 relative">
        <p>© {new Date().getFullYear()} iReserve Smart Reservation System. Crafted with Next.js & Supabase.</p>
      </footer>
    </div>
  );
}
