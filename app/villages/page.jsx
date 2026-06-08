import React from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import VillageDirectory from '@/components/public/VillageDirectory';
import Navbar from '@/components/layout/Navbar';
import { ArrowLeft, Building } from 'lucide-react';

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

    if (villages.length > 0) {
      const { data: properties } = await supabase
        .from('properties')
        .select('village_id, status, price')
        .in('village_id', villages.map((village) => village.id));

      const statsByVillage = new Map();
      for (const property of properties || []) {
        const stats = statsByVillage.get(property.village_id) || {
          properties_count: 0,
          available_count: 0,
          starting_price: null
        };
        stats.properties_count += 1;
        if (property.status === 'available') stats.available_count += 1;
        const price = Number(property.price || 0);
        if (price > 0 && (stats.starting_price === null || price < stats.starting_price)) {
          stats.starting_price = price;
        }
        statsByVillage.set(property.village_id, stats);
      }

      villages = villages.map((village) => {
        const stats = statsByVillage.get(village.id);
        if (!stats) {
          return {
            ...village,
            properties_count: 0,
            available_count: 0
          };
        }
        return {
          ...village,
          properties_count: stats.properties_count,
          available_count: stats.available_count,
          starting_price: stats.starting_price || village.starting_price
        };
      });
    }
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
    <div className="min-h-screen bg-[#f8fafc] text-[#272727] flex flex-col">
      <Navbar />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 md:px-8">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-2 text-xs font-bold text-slate-200 shadow transition hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-300"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-4 shadow">
            <Building className="w-6 h-6" />
          </div>
          <h1 className="mb-3 text-3xl font-extrabold tracking-tight md:text-5xl">
            Browse Villages and Available Lots
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-[#64748b]">
            Compare locations, prices, and available lots. Select a village to learn more and open its interactive map.
          </p>
        </div>

        <VillageDirectory villages={displayedVillages} />
      </main>

      <footer className="mt-12 border-t border-[#e2e8f0] bg-white py-6 text-center text-xs text-[#64748b]">
        <p>© {new Date().getFullYear()} iReserve Reservation Portal. All rights reserved.</p>
      </footer>
    </div>
  );
}
