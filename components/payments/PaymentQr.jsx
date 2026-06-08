'use client';

import React from 'react';

export function makePaymentCode(payload) {
  let hash = 0;
  for (let index = 0; index < payload.length; index += 1) {
    hash = ((hash << 5) - hash + payload.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36).toUpperCase().padStart(8, '0');
}

export default function PaymentQr({ value }) {
  const cells = 25;
  const safeValue = value || 'iReserve-payment';
  const bits = Array.from({ length: cells * cells }, (_, index) => {
    const char = safeValue.charCodeAt(index % safeValue.length) || 0;
    return ((char + index * 17 + Math.floor(index / cells) * 31) % 7) < 3;
  });
  const finder = [
    [0, 0],
    [18, 0],
    [0, 18]
  ];

  return (
    <svg viewBox={`0 0 ${cells} ${cells}`} className="h-full w-full rounded-lg bg-white p-1" role="img" aria-label="Payment QR code">
      <rect width={cells} height={cells} fill="white" />
      {bits.map((active, index) => {
        const x = index % cells;
        const y = Math.floor(index / cells);
        const inFinder = finder.some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);
        if (!active || inFinder) return null;
        return <rect key={index} x={x} y={y} width="1" height="1" fill="#0f172a" />;
      })}
      {finder.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="7" height="7" fill="#0f172a" />
          <rect x={x + 1} y={y + 1} width="5" height="5" fill="white" />
          <rect x={x + 2} y={y + 2} width="3" height="3" fill="#0f172a" />
        </g>
      ))}
    </svg>
  );
}
