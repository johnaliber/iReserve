'use client';

import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import VillageCard from './VillageCard';

export default function VillageCarousel({ villages = [] }) {
  const railRef = useRef(null);
  const pausedRef = useRef(false);
  const frameRef = useRef(null);
  const positionRef = useRef(0);
  const loopWidthRef = useRef(0);

  const applyPosition = () => {
    const rail = railRef.current;
    if (!rail) return;

    const loopWidth = loopWidthRef.current;
    if (loopWidth > 0) {
      while (positionRef.current <= -loopWidth) positionRef.current += loopWidth;
      while (positionRef.current > 0) positionRef.current -= loopWidth;
    }

    rail.style.transform = `translate3d(${positionRef.current}px, 0, 0)`;
  };

  const moveByCard = (direction) => {
    const rail = railRef.current;
    if (!rail) return;
    pausedRef.current = true;
    const card = rail.querySelector('[data-carousel-card]');
    const distance = card ? card.getBoundingClientRect().width + 24 : 360;
    positionRef.current -= direction * distance;
    applyPosition();
  };

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || villages.length <= 1) return undefined;

    const measureLoop = () => {
      const duplicateStart = rail.querySelector('[data-duplicate-start="true"]');
      loopWidthRef.current = duplicateStart?.offsetLeft || rail.scrollWidth / 2;
      applyPosition();
    };

    measureLoop();
    const observer = new ResizeObserver(measureLoop);
    observer.observe(rail);

    const speed = 0.8;
    const tick = () => {
      if (!pausedRef.current) {
        positionRef.current -= speed;
        applyPosition();
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      observer.disconnect();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [villages.length]);

  const loopedVillages = villages.length > 1 ? [...villages, ...villages] : villages;

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
      onFocusCapture={() => {
        pausedRef.current = true;
      }}
      onBlurCapture={() => {
        pausedRef.current = false;
      }}
    >
      <div className="village-carousel-viewport overflow-hidden pb-4" tabIndex={0}>
        <div ref={railRef} className="village-carousel-rail flex w-max gap-6 will-change-transform">
          {loopedVillages.map((village, index) => (
            <div
              key={`${village.id}-${index}`}
              data-carousel-card
              data-duplicate-start={index === villages.length ? 'true' : undefined}
              className="village-carousel-card w-[min(86vw,360px)] shrink-0"
            >
              <VillageCard village={village} />
            </div>
          ))}
        </div>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#f8fafc] via-[#f8fafc]/60 to-transparent md:w-16"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#f8fafc] via-[#f8fafc]/60 to-transparent md:w-16"
      />

      {villages.length > 1 && (
        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 z-20 flex items-center justify-between px-3 md:px-4">
          <button
            type="button"
            onClick={() => moveByCard(-1)}
            className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-800 bg-white/90 text-[#272727] shadow transition hover:border-emerald-400"
            aria-label="Previous villages"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => moveByCard(1)}
            className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-800 bg-white/90 text-[#272727] shadow transition hover:border-emerald-400"
            aria-label="Next villages"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
