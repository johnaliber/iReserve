'use client';

import { useEffect, useState } from 'react';
import BrandLogo from '@/components/brand/BrandLogo';

export default function DelayedLoadingState({
  loading = true,
  delay = 1000,
  fullScreen = false,
  message = 'Preparing your iReserve page...'
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!loading) return undefined;
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay, loading]);

  if (!loading || !visible) return null;

  return (
    <div className={`${fullScreen ? 'fixed inset-0 z-[120]' : 'min-h-[360px]'} flex items-center justify-center bg-[#f8fafc]/95 p-6 backdrop-blur-sm`}>
      <div className="text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-emerald-100 bg-white shadow-xl shadow-emerald-900/5">
          <div className="ireserve-loader-ring flex h-14 w-14 items-center justify-center rounded-full">
            <BrandLogo compact />
          </div>
        </div>
        <p className="mt-5 text-sm font-extrabold text-[#272727]">Just a moment</p>
        <p className="mt-1 text-xs text-[#64748b]">{message}</p>
      </div>
    </div>
  );
}
