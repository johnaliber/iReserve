'use client';

import React from 'react';
import Link from 'next/link';
import { MapPin, ArrowRight, Home } from 'lucide-react';

export default function VillageCard({ village }) {
  const {
    name,
    slug,
    description,
    address,
    city,
    province,
    hero_image_url,
    starting_price,
    properties_count = 0,
    available_count = 0
  } = village;

  // Premium default mock image if hero_image_url is missing
  const heroImage = hero_image_url || 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=600&q=80';

  return (
    <div className="group glass-card rounded-2xl overflow-hidden shadow-lg border border-slate-800/80 flex flex-col h-full hover:border-emerald-500/30 transition-all duration-300">
      {/* Hero Image Container */}
      <div className="relative h-48 w-full overflow-hidden">
        <img
          src={heroImage}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
        
        {/* Available Properties Tag */}
        <div className="absolute top-4 right-4 bg-emerald-500 text-slate-950 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-md shadow-emerald-500/10 select-none">
          <Home className="w-3.5 h-3.5" />
          <span>{available_count} Available</span>
        </div>
      </div>

      {/* Info Content */}
      <div className="p-6 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1 text-slate-400 text-xs mb-2">
            <MapPin className="w-3.5 h-3.5 text-emerald-400/80" />
            <span>{city}, {province}</span>
          </div>

          <h3 className="text-xl font-bold text-slate-100 group-hover:text-emerald-400 transition mb-2">
            {name}
          </h3>

          <p className="text-slate-400 text-xs leading-relaxed line-clamp-3 mb-4">
            {description || 'Experience smart, highly connected modern subdivision living, complete with state of the art amenities, clean roads, visual layouts, and 24/7 security services.'}
          </p>
        </div>

        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Starting From</span>
            <span className="text-emerald-400 font-extrabold text-lg">
              ₱{Number(starting_price).toLocaleString()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/villages/${slug}`}
              className="inline-flex items-center justify-center p-2.5 rounded-xl border border-slate-800 hover:border-emerald-500/30 text-slate-300 hover:text-white hover:bg-slate-800/40 transition-all text-xs font-semibold cursor-pointer"
              title="Explore Details"
            >
              Explore
            </Link>
            
            <Link
              href={`/villages/${slug}/map`}
              className="inline-flex items-center justify-center gap-1 px-3 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 rounded-xl font-bold text-xs shadow-lg shadow-emerald-500/5 transition cursor-pointer"
            >
              View Map
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
