'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function AssignedVillagesCell({
  villages = [],
  isGlobalAccess = false,
  maxVisible = 2
}) {
  const triggerRef = useRef(null);
  const closeTimerRef = useRef(null);
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);

  const assignedVillages = useMemo(() => {
    const unique = new Map();

    villages.filter(Boolean).forEach((village, index) => {
      const name = village.name?.trim() || 'Village';
      const key = village.id || `${name}-${index}`;
      if (!unique.has(key)) unique.set(key, { ...village, name });
    });

    return [...unique.values()];
  }, [villages]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const estimatedWidth = Math.min(320, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - estimatedWidth - 12));
    const placeAbove = rect.top >= 190;

    setPosition({
      left,
      top: placeAbove ? rect.top - 8 : rect.bottom + 8,
      transform: placeAbove ? 'translateY(-100%)' : 'none'
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
  }, []);

  if (isGlobalAccess) {
    return <span className="text-sm font-semibold text-purple-700">Global access</span>;
  }

  if (assignedVillages.length === 0) {
    return <span className="text-sm font-medium text-[#5f7068]">No assigned village</span>;
  }

  const visibleVillages = assignedVillages.slice(0, maxVisible);
  const hiddenCount = Math.max(0, assignedVillages.length - visibleVillages.length);

  const showTooltip = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    updatePosition();
    setOpen(true);
  };

  const hideTooltip = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 120);
  };

  return (
    <>
      <div
        ref={triggerRef}
        tabIndex={0}
        aria-describedby={open ? tooltipId : undefined}
        aria-label={`${assignedVillages.length} assigned village${assignedVillages.length === 1 ? '' : 's'}`}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
            event.currentTarget.blur();
          }
        }}
        className="flex max-w-[260px] flex-nowrap items-center gap-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
      >
        {visibleVillages.map((village) => (
          <span
            key={village.id || village.name}
            className="max-w-[112px] truncate rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800"
            title={village.name}
          >
            {village.name}
          </span>
        ))}

        {hiddenCount > 0 && (
          <span className="shrink-0 rounded-full border border-[#cbd5e1] bg-[#e2e8f0] px-2 py-0.5 text-xs font-semibold text-[#1e293b]">
            +{hiddenCount} more
          </span>
        )}
      </div>

      {open && position && createPortal(
        <div
          id={tooltipId}
          role="tooltip"
          style={position}
          onMouseEnter={showTooltip}
          onMouseLeave={hideTooltip}
          className="fixed z-[120] w-max max-w-[320px] rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-left shadow-xl"
        >
          <p className="mb-1.5 text-xs font-extrabold uppercase tracking-wider !text-emerald-800">
            Assigned Villages
          </p>
          <ul className="max-h-64 space-y-1 overflow-y-auto pr-1 text-sm">
            {assignedVillages.map((village) => (
              <li key={village.id || village.name} className="flex gap-2 !text-emerald-900">
                <span aria-hidden="true" className="!text-emerald-600">-</span>
                <span>{village.name}</span>
              </li>
            ))}
          </ul>
        </div>,
        document.body
      )}
    </>
  );
}
