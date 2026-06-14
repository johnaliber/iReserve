import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import Navbar from '@/components/layout/Navbar';
import VillageCarousel from '@/components/public/VillageCarousel';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  CreditCard,
  Home,
  Map,
  MousePointerClick,
  ShieldCheck
} from 'lucide-react';

export const revalidate = 0;

export default async function HomePage() {
  let villages = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('villages').select('*').eq('status', 'active').order('created_at', { ascending: false });
    villages = data || [];
    if (villages.length) {
      const { data: properties } = await supabase
        .from('properties')
        .select('village_id, status, price')
        .in('village_id', villages.map((village) => village.id));
      const stats = new globalThis.Map();
      for (const property of properties || []) {
        const current = stats.get(property.village_id) || { available_count: 0, starting_price: null };
        if (property.status === 'available') current.available_count += 1;
        const price = Number(property.price || 0);
        if (price > 0 && (!current.starting_price || price < current.starting_price)) current.starting_price = price;
        stats.set(property.village_id, current);
      }
      villages = villages.map((village) => ({ ...village, ...(stats.get(village.id) || {} ) }));
    }
  } catch (error) {
    console.error('Error fetching villages on homepage:', error);
  }

  let accountHref = null;
  try {
    const role = (await getCurrentUser())?.profile?.role;
    accountHref = {
      customer: '/customer/dashboard',
      super_admin: '/super-admin/dashboard',
      village_admin: '/village-admin/dashboard',
      accounting: '/accounting/dashboard',
      architect: '/architect/dashboard'
    }[role] || null;
  } catch {
    accountHref = null;
  }

  const displayedVillages = villages.length ? villages : [{
    id: 'sample',
    name: 'Sample Village',
    slug: 'emerald-ridge',
    description: 'A comfortable community with secure roads, shared amenities, and available residential lots.',
    city: 'Tagaytay',
    province: 'Cavite',
    starting_price: 4500000,
    available_count: 12,
    hero_image_url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=900&q=80'
  }];

  const steps = [
    ['1', 'Choose a village', 'Compare communities, locations, and starting prices.'],
    ['2', 'Click a lot or house', 'Green lots are available. Select one to see the details.'],
    ['3', 'Submit reservation details', 'Fill in your information and upload a clear receipt.'],
    ['4', 'Track your reservation online', 'Check payments, documents, and updates from your account.']
  ];

  const benefits = [
    [Map, 'Interactive map', 'See where each available lot is located.'],
    [MousePointerClick, 'Easy reservation', 'Follow simple steps with clear instructions.'],
    [CreditCard, 'Payment tracking', 'See the amount paid and remaining balance.'],
    [Calendar, 'Site viewing schedule', 'Request a convenient date and time online.']
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#272727]">
      <Navbar />
      {accountHref && (
        <div className="mx-auto w-full max-w-7xl px-4 pt-4 md:px-8">
          <Link href={accountHref} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#dbe4ee] bg-white px-4 text-xs font-bold text-[#475569] shadow-sm">
            <ArrowLeft className="h-4 w-4" /> Back to Account
          </Link>
        </div>
      )}

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 md:px-8 lg:grid-cols-[1.05fr_.95fr] lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700">
              <ShieldCheck className="h-4 w-4" /> Simple and secure online reservations
            </span>
            <h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
              Reserve your future home with an <span className="text-emerald-600">interactive village map.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#64748b] md:text-lg">
              Browse villages, click available lots, view details, and reserve online.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="#featured-villages" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-extrabold text-white shadow-lg shadow-emerald-900/10 hover:bg-emerald-500">
                Browse Villages <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold text-[#64748b]">
              {['Clear lot availability', 'Receipt review updates', 'Customer account tracking'].map((item) => (
                <span key={item} className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{item}</span>
              ))}
            </div>
          </div>
          <div className="relative overflow-hidden rounded-[2rem] border border-emerald-100 bg-white p-3 shadow-2xl shadow-emerald-900/10">
            <img src={displayedVillages[0].hero_image_url} alt="Village homes" className="h-105 w-full rounded-[1.4rem] object-cover" />
            <div className="absolute bottom-8 left-8 right-8 rounded-2xl border border-white/60 bg-white/90 p-4 shadow-xl backdrop-blur">
              
            </div>
          </div>
        </section>

        <section className="border-y border-[#e2e8f0] bg-white py-16">
          <div className="mx-auto max-w-7xl px-4 md:px-8">
            <div className="text-center"><p className="text-xs font-extrabold uppercase tracking-wider text-emerald-600">How It Works</p><h2 className="mt-2 text-3xl font-extrabold">Four simple steps</h2></div>
            <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {steps.map(([number, title, description]) => (
                <article key={number} className="rounded-2xl border border-[#e2e8f0] p-5 shadow-sm">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 font-extrabold text-white">{number}</span>
                  <h3 className="mt-4 font-extrabold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#64748b]">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="featured-villages" className="mx-auto max-w-7xl px-4 py-16 md:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-xs font-extrabold uppercase tracking-wider text-emerald-600">Featured Villages</p><h2 className="mt-2 text-3xl font-extrabold">Explore available communities</h2><p className="mt-2 text-sm text-[#64748b]">Compare the basics before opening the interactive map.</p></div>
            <Link href="/villages" className="text-sm font-extrabold text-emerald-700">View all villages</Link>
          </div>
          <div className="mt-8">
            <VillageCarousel villages={displayedVillages.slice(0, 6)} />
          </div>
        </section>

        <section className="bg-[#ecfdf5] py-16">
          <div className="mx-auto max-w-7xl px-4 md:px-8">
            <div className="text-center"><p className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">Why Use iReserve</p><h2 className="mt-2 text-3xl font-extrabold">Everything important in one place</h2></div>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {benefits.map(([Icon, title, description]) => (
                <article key={title} className="rounded-2xl bg-white p-5 shadow-sm"><Icon className="h-6 w-6 text-emerald-600" /><h3 className="mt-4 font-extrabold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#64748b]">{description}</p></article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-[#e2e8f0] bg-white py-6 text-center text-xs text-[#64748b]">© {new Date().getFullYear()} iReserve. All rights reserved.</footer>
    </div>
  );
}
