'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Bath,
  BedDouble,
  Car,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Home,
  ImageOff,
  Maximize2
} from 'lucide-react';

function formatPeso(value) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function relativePosition(index, activeIndex, total) {
  let distance = index - activeIndex;
  if (distance > total / 2) distance -= total;
  if (distance < -total / 2) distance += total;
  return distance;
}

function ShowcaseImage({ src, alt, className, failed, onError, onOrientation }) {
  return (
    <div className={`relative overflow-hidden bg-white ${className}`}>
      {failed ? (
        <div className="flex h-full flex-col items-center justify-center px-4 text-center">
          <ImageOff className="h-8 w-8 text-[#94a3b8]" />
          <p className="mt-2 text-xs font-bold text-[#64748b]">Image unavailable</p>
        </div>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          sizes="(max-width: 768px) 92vw, 860px"
          className="object-cover object-center"
          onLoad={(event) => {
            const image = event.currentTarget;
            const orientation = image.naturalWidth > image.naturalHeight
              ? 'landscape'
              : image.naturalWidth < image.naturalHeight
                ? 'portrait'
                : 'square';
            onOrientation?.(orientation);
          }}
          onError={onError}
        />
      )}
    </div>
  );
}

export default function HouseShowcaseCarousel({ houses, mapHref = '#' }) {
  const [selectedHouseId, setSelectedHouseId] = useState(houses[0]?.id || '');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [failedImages, setFailedImages] = useState([]);
  const [imageOrientations, setImageOrientations] = useState({});
  const pointerStart = useRef(null);

  const selectedHouse = houses.find((house) => house.id === selectedHouseId) || houses[0];
  const images = Array.isArray(selectedHouse?.house_images) ? selectedHouse.house_images : [];
  const total = images.length;
  const modelName = selectedHouse?.model_name || selectedHouse?.name || 'House model';

  const moveImage = (direction) => {
    if (total < 2) return;
    setActiveImageIndex((current) => (current + direction + total) % total);
  };

  const markImageFailed = (imageUrl) => {
    setFailedImages((current) => (
      current.includes(imageUrl) ? current : [...current, imageUrl]
    ));
  };

  const recordOrientation = (imageUrl, orientation) => {
    setImageOrientations((current) => (
      current[imageUrl] === orientation
        ? current
        : { ...current, [imageUrl]: orientation }
    ));
  };

  useEffect(() => {
    if (paused || total < 2) return undefined;
    const timer = window.setInterval(() => {
      setActiveImageIndex((current) => (current + 1) % total);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [paused, selectedHouseId, total]);

  if (!selectedHouse || !total) return null;

  const specs = [
    { icon: Maximize2, label: 'Floor Area', value: `${Number(selectedHouse.floor_area || 0)} sqm` },
    { icon: Home, label: 'Lot Area', value: `${Number(selectedHouse.lot_size || 0)} sqm` },
    { icon: BedDouble, label: 'Bedrooms', value: Number(selectedHouse.bedrooms || 0) },
    { icon: Bath, label: 'Bathrooms', value: Number(selectedHouse.bathrooms || 0) },
    { icon: Car, label: 'Parking', value: Number(selectedHouse.parking_slots || 0) }
  ];

  return (
    <div
      className="rounded-[1.75rem] border border-[#e2e8f0] bg-white p-4 shadow-sm sm:p-6 lg:p-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') moveImage(-1);
        if (event.key === 'ArrowRight') moveImage(1);
      }}
      onPointerDown={(event) => {
        pointerStart.current = event.clientX;
      }}
      onPointerUp={(event) => {
        if (pointerStart.current === null) return;
        const distance = event.clientX - pointerStart.current;
        if (Math.abs(distance) > 45) moveImage(distance > 0 ? -1 : 1);
        pointerStart.current = null;
      }}
      tabIndex={0}
      aria-label={`${modelName} image carousel`}
    >
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-600">Explore Our Homes</p>
          <h2 className="mt-1 text-2xl font-extrabold text-[#272727] sm:text-3xl">Find a house that feels like yours</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#64748b]">
            Explore our thoughtfully designed house models. Swipe or use the controls to find the perfect home for you.
          </p>
        </div>
        <label className="w-full md:w-64">
          <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-[#475569]">House Model</span>
          <span className="relative block">
            <Home className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
            <select
              value={selectedHouse.id}
              onChange={(event) => {
                setSelectedHouseId(event.target.value);
                setActiveImageIndex(0);
              }}
              className="w-full appearance-none rounded-xl border border-emerald-300 bg-white py-2.5 pl-10 pr-10 text-sm font-bold text-[#272727] shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
            >
              {houses.map((house) => (
                <option key={house.id} value={house.id}>
                  {house.model_name || house.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" />
          </span>
        </label>
      </div>

      <div
        className="relative h-[300px] overflow-hidden sm:h-[390px] lg:h-[430px]"
        style={{ perspective: '1400px' }}
      >
        <div className="pointer-events-none absolute inset-x-[18%] bottom-5 h-12 rounded-full bg-[#17211d]/15 blur-2xl" />

        {images.map((imageUrl, index) => {
          const position = relativePosition(index, activeImageIndex, total);
          const distance = Math.abs(position);
          const visible = distance <= 1;
          const active = position === 0;
          const orientation = imageOrientations[imageUrl] || 'unknown';
          const scale = active ? 1 : 0.78;
          const rotateY = position * -10;

          return (
            <button
              key={`${imageUrl}-${index}`}
              type="button"
              onClick={() => setActiveImageIndex(index)}
              className={`absolute left-1/2 top-1/2 overflow-hidden rounded-2xl border bg-white text-left transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                active
                  ? 'w-[88%] border-white shadow-[0_24px_55px_rgba(15,23,42,0.22)] sm:w-[72%] lg:w-[62%]'
                  : 'w-[72%] border-[#dbe4ee] shadow-xl sm:w-[58%] lg:w-[48%]'
              }`}
              style={{
                left: `${50 + (position * 37)}%`,
                height: active ? '92%' : '72%',
                opacity: visible ? (active ? 1 : 0.68) : 0,
                pointerEvents: visible ? 'auto' : 'none',
                transform: `translate(-50%, -50%) translateZ(${active ? 100 : -140}px) rotateY(${rotateY}deg) scale(${scale})`,
                zIndex: 20 - distance,
                filter: active ? 'none' : 'saturate(0.82) brightness(0.94)'
              }}
              aria-label={`Show ${modelName} image ${index + 1}`}
              aria-current={active ? 'true' : undefined}
            >
              <ShowcaseImage
                src={imageUrl}
                alt={`${modelName}, ${orientation} image ${index + 1}`}
                failed={failedImages.includes(imageUrl)}
                onError={() => markImageFailed(imageUrl)}
                onOrientation={(value) => recordOrientation(imageUrl, value)}
                className="h-full w-full"
              />
              <span className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#102019]/90 via-[#102019]/45 to-transparent text-white ${
                active ? 'px-5 pb-5 pt-20 sm:px-6 sm:pb-6' : 'px-4 pb-4 pt-16'
              }`}>
                <span
                  className={`block font-extrabold ${active ? 'text-lg sm:text-xl' : 'text-sm'}`}
                  style={{ color: '#ffffff' }}
                >
                  {modelName}
                </span>
                {/* <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-emerald-100">
                  {active
                    ? `${selectedHouse.property_type?.replaceAll('_', ' ') || 'House and Lot'} · ${orientation === 'unknown' ? 'House View' : orientation}`
                    : position < 0
                      ? 'Previous view'
                      : 'Next view'}
                </span> */}
              </span>
            </button>
          );
        })}

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => moveImage(-1)}
              className="absolute left-2 top-1/2 z-30 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#dbe4ee] bg-white/95 text-[#334155] shadow-lg backdrop-blur transition duration-300 hover:scale-105 hover:border-emerald-300 hover:text-emerald-700 sm:left-4 lg:left-7"
              aria-label={`Previous ${modelName} image`}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => moveImage(1)}
              className="absolute right-2 top-1/2 z-30 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#dbe4ee] bg-white/95 text-[#334155] shadow-lg backdrop-blur transition duration-300 hover:scale-105 hover:border-emerald-300 hover:text-emerald-700 sm:right-4 lg:right-7"
              aria-label={`Next ${modelName} image`}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

      </div>

      {total > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2" role="tablist" aria-label={`${modelName} images`}>
          {images.map((imageUrl, index) => (
            <button
              key={`${imageUrl}-dot-${index}`}
              type="button"
              onClick={() => setActiveImageIndex(index)}
              className={`h-2 rounded-full transition-all duration-500 ${
                index === activeImageIndex ? 'w-8 bg-emerald-600' : 'w-2 bg-[#cbd5e1] hover:bg-emerald-300'
              }`}
              aria-label={`Show image ${index + 1}`}
              aria-selected={index === activeImageIndex}
              role="tab"
            />
          ))}
        </div>
      )}

      <div className="relative z-20 mx-auto mt-4 w-full rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm sm:w-[94%] sm:p-5">
        <div className="grid gap-5 lg:grid-cols-[1.15fr_2fr_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-extrabold text-emerald-700">{modelName}</h3>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-emerald-700">
                {selectedHouse.property_type?.replaceAll('_', ' ') || 'House and Lot'}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#64748b]">
              {selectedHouse.description || 'A thoughtfully designed home with a comfortable layout and practical living spaces.'}
            </p>
            <p className="mt-2 text-lg font-extrabold text-[#272727]">{formatPeso(selectedHouse.price)}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {specs.map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-xl bg-[#f5f9f7] px-2 py-3 text-center">
                <Icon className="mx-auto h-4 w-4 text-emerald-600" />
                <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-[#64748b]">{label}</p>
                <p className="mt-1 text-xs font-extrabold text-[#272727]">{value}</p>
              </div>
            ))}
          </div>

          <Link
            href={mapHref}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-500"
          >
            View Available Properties
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

    </div>
  );
}
