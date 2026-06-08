import React from 'react';
import { createClient } from '@/lib/supabase/server';
import Navbar from '@/components/layout/Navbar';
import { 
  ArrowLeft,
  MapPin, 
  Trees, 
  Map, 
  Calendar, 
  DollarSign, 
  Sparkles, 
  Info,
  Layers,
  ChevronRight,
  Shield,
  Coffee,
  Activity,
  Sun
} from 'lucide-react';
import Link from 'next/link';
import InquiryForm from '@/components/public/InquiryForm';

export const revalidate = 0;

export default async function VillageLandingPage({ params }) {
  const { slug } = await params;
  let village = null;
  let properties = [];

  try {
    const supabase = await createClient();
    
    // Fetch village by slug
    const { data: villageData } = await supabase
      .from('villages')
      .select('*')
      .eq('slug', slug)
      .single();

    if (villageData) {
      village = villageData;
      
      // Fetch properties for count
      const { data: propData } = await supabase
        .from('properties')
        .select('*')
        .eq('village_id', village.id);
      
      properties = propData || [];
    }
  } catch (error) {
    console.error('Error fetching village details:', error);
  }

  // Fallback mocks if not found in database for immediate visualization
  const mockVillages = {
    'emerald-ridge': {
      id: 'mock-1',
      name: 'Emerald Ridge Heights',
      slug: 'emerald-ridge',
      description: 'A luxurious eco-friendly smart subdivision sitting on a gentle ridge. Designed for sustainable luxury, Emerald Ridge Heights blends modern solar infrastructure with serene pine trails and natural elevation. Experience pristine air, secure gated gates, visual coordinates mapping, and an organic community farm.',
      address: 'KM 54 Ridge Highway',
      city: 'Tagaytay',
      province: 'Cavite',
      starting_price: 4500000,
      hero_image_url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
      amenities: ['Pine Trails', 'Solar Lighting', 'Organic Farm', 'Clubhouse', 'Guard House', '24/7 Patrols']
    },
    'teal-lagoon': {
      id: 'mock-2',
      name: 'Teal Lagoon Residences',
      slug: 'teal-lagoon',
      description: 'A premium lakeside community centered around a natural recreational lagoon. Teal Lagoon Residences offers an unmatched waterfront experience, featuring a private yacht dock, sandy volleyball courts, and lush trails. Homes are configured with clean modern architecture and fiber optics.',
      address: 'Lagoon Circle Drive',
      city: 'Calamba',
      province: 'Laguna',
      starting_price: 3800000,
      hero_image_url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
      amenities: ['Waterfront Docks', 'Lagoon Clubhouse', 'Volleyball Court', 'Lakeside Cabanas', 'Security Gates', 'Sidewalk Paths']
    }
  };

  const selectedVillage = village || mockVillages[slug] || mockVillages['emerald-ridge'];
  const isRealVillage = Boolean(village);
  
  const totalPropsCount = isRealVillage ? properties.length : 24;
  const availablePropsCount = isRealVillage ? properties.filter(p => p.status === 'available').length : 12;

  // Render icons for specific amenities
  const getAmenityIcon = (name) => {
    const lowercase = name.toLowerCase();
    if (lowercase.includes('guard') || lowercase.includes('patrol') || lowercase.includes('security')) {
      return <Shield className="w-5 h-5 text-emerald-400" />;
    }
    if (lowercase.includes('clubhouse') || lowercase.includes('cabana') || lowercase.includes('coffee')) {
      return <Coffee className="w-5 h-5 text-emerald-400" />;
    }
    if (lowercase.includes('trail') || lowercase.includes('tree') || lowercase.includes('farm')) {
      return <Trees className="w-5 h-5 text-emerald-400" />;
    }
    if (lowercase.includes('lighting') || lowercase.includes('solar') || lowercase.includes('sun')) {
      return <Sun className="w-5 h-5 text-emerald-400" />;
    }
    return <Activity className="w-5 h-5 text-emerald-400" />;
  };

  const currentAmenities = selectedVillage.amenities || [
    'Subdivision Clubhouse', 
    '24/7 Guard Gate', 
    'Tree-Lined Sidewalks', 
    'Solar Streetlights', 
    'Flood-Free Zone Area', 
    'Swimming Pool'
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-30%] right-[-10%] w-[1000px] h-[1000px] rounded-full bg-emerald-950/15 blur-[180px] pointer-events-none" />

      <Navbar />

      {/* Hero Section */}
      <section className="relative h-[65vh] w-full overflow-hidden">
        <img
          src={selectedVillage.hero_image_url || 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80'}
          alt={selectedVillage.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
        
        <div className="absolute bottom-0 left-0 right-0 p-8 max-w-7xl mx-auto w-full z-10">
          <Link
            href="/"
            className="mb-5 inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-2 text-xs font-bold text-slate-200 shadow transition hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-300"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-4 select-none">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Lots Available to Explore</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400 text-sm mb-2">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span>{selectedVillage.address}, {selectedVillage.city}, {selectedVillage.province}</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-white">
            {selectedVillage.name}
          </h1>

          <div className="flex flex-wrap gap-4 text-sm mt-2">
            <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl px-4 py-2 flex flex-col">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Starting Price</span>
              <span className="text-emerald-400 font-extrabold text-base">₱{Number(selectedVillage.starting_price).toLocaleString()}</span>
            </div>
            <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl px-4 py-2 flex flex-col">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Available Lots</span>
              <span className="text-white font-extrabold text-base">{availablePropsCount} / {totalPropsCount} lots</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Details and CTAs */}
      <section className="max-w-7xl mx-auto w-full px-4 py-12 grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
        
        {/* Left Column: Description & Amenities */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 md:p-8 glass-card">
            <h2 className="text-xl font-bold mb-4 text-slate-200">Village Overview</h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-6 whitespace-pre-line">
              {selectedVillage.description}
            </p>
          </div>

          {/* Amenities Grid */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 md:p-8 glass-card">
            <h2 className="text-xl font-bold mb-6 text-slate-200">Amenities</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {currentAmenities.map((amenity, idx) => (
                <div key={idx} className="flex gap-4 items-start p-4 bg-slate-950/40 border border-slate-900 rounded-xl hover:border-emerald-500/20 transition-all duration-200">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 shadow-inner flex-shrink-0">
                    {getAmenityIcon(amenity)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-200 text-sm">{amenity}</h4>
                    <p className="text-slate-500 text-[11px] mt-1 leading-normal">
                      Available for residents and visitors within the community.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: CTA Panel */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl sticky top-24">
            <h3 className="text-lg font-bold text-slate-200 mb-2">Explore This Village</h3>
            <p className="text-slate-400 text-xs leading-relaxed mb-6">
              Open the interactive map to see available lots, prices, surroundings, and important property details.
            </p>

            <div className="space-y-4">
              <Link
                href={`/villages/${selectedVillage.slug}/map`}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold py-3.5 px-4 rounded-xl transition shadow-lg shadow-emerald-500/15 text-sm cursor-pointer"
              >
                <Map className="w-4 h-4" />
                View Interactive Map
              </Link>

              <Link
                href={`/villages/${selectedVillage.slug}/map?view=recommendation`}
                className="w-full flex items-center justify-center gap-2 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 font-semibold py-3 px-4 rounded-xl transition text-sm cursor-pointer"
              >
                <Layers className="w-4 h-4 text-emerald-400" />
                Browse Available Lots
              </Link>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-800/80 space-y-4 text-xs text-slate-400">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-slate-500" />
                  Reservation Hold
                </span>
                <span className="font-bold text-emerald-400">48 Hours</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Reservation Fee</span>
                <span className="font-bold text-white">₱5,000.00</span>
              </div>
            </div>
          </div>
        </div>

      </section>

      {properties.filter((property) => property.status === 'available').length > 0 && (
        <section id="available-lots" className="mx-auto w-full max-w-7xl px-4 pb-12">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-600">Available Lots Preview</p>
              <h2 className="mt-1 text-2xl font-extrabold text-[#272727]">A few lots you can view now</h2>
            </div>
            <Link href={`/villages/${selectedVillage.slug}/map`} className="text-sm font-extrabold text-emerald-700">View All Lots</Link>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {properties.filter((property) => property.status === 'available').slice(0, 3).map((property) => (
              <Link key={property.id} href={`/villages/${selectedVillage.slug}/map`} className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm transition hover:border-emerald-200">
                <p className="font-extrabold text-[#272727]">Block {property.block_number}, Lot {property.lot_number}</p>
                <p className="mt-1 text-sm text-[#64748b]">{property.lot_size} sqm lot area</p>
                <p className="mt-4 text-lg font-extrabold text-emerald-700">PHP {Number(property.price || 0).toLocaleString()}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto w-full max-w-7xl px-4 pb-12">
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
          <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-600">Location</p>
          <h2 className="mt-1 text-xl font-extrabold text-[#272727]">{selectedVillage.address}</h2>
          <p className="mt-1 text-sm text-[#64748b]">{selectedVillage.city}, {selectedVillage.province}</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link href={`/villages/${selectedVillage.slug}/map`} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-extrabold text-white">View Available Lots</Link>
            <Link href="/customer/site-viewing" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#dbe4ee] bg-white px-5 text-sm font-extrabold text-[#272727]">Schedule Site Viewing</Link>
          </div>
        </div>
      </section>

      {isRealVillage && (
        <section className="mx-auto w-full max-w-4xl px-4 pb-12">
          <InquiryForm villageId={selectedVillage.id} />
        </section>
      )}

      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} iReserve Reservation Portal. All rights reserved.</p>
      </footer>
    </div>
  );
}
