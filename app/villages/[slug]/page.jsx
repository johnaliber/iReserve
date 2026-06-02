import React from 'react';
import { createClient } from '@/lib/supabase/server';
import Navbar from '@/components/layout/Navbar';
import { 
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
  
  const totalPropsCount = properties.length > 0 ? properties.length : 24;
  const availablePropsCount = properties.length > 0 ? properties.filter(p => p.status === 'available').length : 12;

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
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-4 select-none">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Interactive Vector Subdivision Blueprint Ready</span>
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
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Available Plots</span>
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
            <h2 className="text-xl font-bold mb-4 text-slate-200">About the Subdivision</h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-6 whitespace-pre-line">
              {selectedVillage.description}
            </p>
          </div>

          {/* Amenities Grid */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 md:p-8 glass-card">
            <h2 className="text-xl font-bold mb-6 text-slate-200">State-Of-The-Art Amenities</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {currentAmenities.map((amenity, idx) => (
                <div key={idx} className="flex gap-4 items-start p-4 bg-slate-950/40 border border-slate-900 rounded-xl hover:border-emerald-500/20 transition-all duration-200">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 shadow-inner flex-shrink-0">
                    {getAmenityIcon(amenity)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-200 text-sm">{amenity}</h4>
                    <p className="text-slate-500 text-[11px] mt-1 leading-normal">
                      Maintained and fully integrated into the community visual ecosystem maps.
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
            <h3 className="text-lg font-bold text-slate-200 mb-2">Book Your Lot Now</h3>
            <p className="text-slate-400 text-xs leading-relaxed mb-6">
              Don&apos;t guess what your surroundings look like. Open our interactive vector blueprint to verify sunlight orientation, streets, and amenities live.
            </p>

            <div className="space-y-4">
              <Link
                href={`/villages/${selectedVillage.slug}/map`}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold py-3.5 px-4 rounded-xl transition shadow-lg shadow-emerald-500/15 text-sm cursor-pointer"
              >
                <Map className="w-4 h-4" />
                Launch Blueprint Map
              </Link>

              <Link
                href={`/villages/${selectedVillage.slug}/map?view=recommendation`}
                className="w-full flex items-center justify-center gap-2 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 font-semibold py-3 px-4 rounded-xl transition text-sm cursor-pointer"
              >
                <Layers className="w-4 h-4 text-emerald-400" />
                Smart Recommendations
              </Link>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-800/80 space-y-4 text-xs text-slate-400">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-slate-500" />
                  Reservation Expiry
                </span>
                <span className="font-bold text-emerald-400">48 Hours</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Hold Deposit Fee</span>
                <span className="font-bold text-white">₱5,000.00</span>
              </div>
            </div>
          </div>
        </div>

      </section>

      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} iReserve Reservation Portal. All rights reserved.</p>
      </footer>
    </div>
  );
}
