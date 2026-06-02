import React from 'react';
import { createClient } from '@/lib/supabase/server';
import VillageCard from '@/components/public/VillageCard';
import Navbar from '@/components/layout/Navbar';
import { Search, Building } from 'lucide-react';

export const revalidate = 0;

export default async function VillagesPage() {
  let villages = [];

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('villages')
      .select('*')
      .eq('status', 'active')
      .order('name');
    villages = data || [];
  } catch (error) {
    console.error('Error fetching villages list:', error);
  }

  // Pre-configured mock list if empty
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
      <div className="absolute top-[-25%] left-[-10%] w-[900px] h-[900px] rounded-full bg-emerald-950/10 blur-[150px] pointer-events-none" />

      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-12 relative z-10">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-4 shadow">
            <Building className="w-6 h-6" />
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-3">
            Subdivision Portals
          </h1>
          <p className="text-slate-400 text-sm max-w-xl mx-auto leading-relaxed">
            Choose your community and launch visual canvas editors to pick specific parcels.
          </p>
        </div>

        {/* Villages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayedVillages.map((village) => (
            <VillageCard key={village.id} village={village} />
          ))}
        </div>
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/50 py-6 text-center text-xs text-slate-500 mt-12">
        <p>© {new Date().getFullYear()} iReserve Reservation Portal. All rights reserved.</p>
      </footer>
    </div>
  );
}
