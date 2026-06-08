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
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl">
      {/* Hero Image Container */}
      <div className="relative h-48 w-full overflow-hidden">
        <img
          src={heroImage}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        
        {/* Available Properties Tag */}
        <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-md">
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

          <h3 className="mb-2 text-xl font-extrabold text-[#272727] transition group-hover:text-emerald-700">
            {name}
          </h3>

          <p className="mb-4 line-clamp-3 text-sm leading-6 text-[#64748b]">
            {description || 'Experience smart, highly connected modern subdivision living, complete with state of the art amenities, clean roads, visual layouts, and 24/7 security services.'}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#e2e8f0] pt-4">
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Starting From</span>
            <span className="text-lg font-extrabold text-emerald-700">
              {Number(starting_price || 0) > 0 ? `PHP ${Number(starting_price).toLocaleString()}` : 'Ask sales'}
            </span>
          </div>

          <div>
            <Link
              href={`/villages/${slug}`}
              className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-emerald-600 px-4 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-500"
            >
              View Village
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
