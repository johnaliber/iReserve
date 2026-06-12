'use client';

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromDateKey(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function monthGrid(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

export default function AvailabilityCalendar({
  availableDates = [],
  selectedDate = '',
  onSelect,
  onToggle,
  editable = false,
  minDate = toDateKey(new Date())
}) {
  const initialMonth = selectedDate ? fromDateKey(selectedDate) : new Date();
  const [visibleMonth, setVisibleMonth] = useState(new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1));
  const availableSet = useMemo(() => new Set(availableDates.map((item) => (
    typeof item === 'string' ? item : item.available_date
  ))), [availableDates]);
  const days = useMemo(() => monthGrid(visibleMonth), [visibleMonth]);

  const changeMonth = (amount) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  return (
    <div className="w-full rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          className="rounded-full p-2 text-[#64748b] transition hover:bg-[#f1f5f9] hover:text-[#272727]"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="text-sm font-extrabold text-[#272727]">
          {visibleMonth.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}
        </h3>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          className="rounded-full p-2 text-[#64748b] transition hover:bg-[#f1f5f9] hover:text-[#272727]"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((day) => (
          <div key={day} className="pb-2 text-[11px] font-bold text-[#94a3b8]">
            {day}
          </div>
        ))}

        {days.map((date) => {
          const dateKey = toDateKey(date);
          const inCurrentMonth = date.getMonth() === visibleMonth.getMonth();
          const isPast = dateKey < minDate;
          const isAvailable = availableSet.has(dateKey);
          const isSelected = dateKey === selectedDate;
          const disabled = editable ? isPast || !inCurrentMonth : isPast || !inCurrentMonth || !isAvailable;

          return (
            <button
              key={dateKey}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (editable) onToggle?.(dateKey, isAvailable);
                else onSelect?.(dateKey);
              }}
              aria-label={`${date.toLocaleDateString('en-PH')} ${isAvailable ? 'available' : 'unavailable'}`}
              className={`relative mx-auto flex h-9 w-9 items-center justify-center rounded-xl text-sm transition ${
                isSelected
                  ? 'border border-emerald-400 bg-emerald-100 font-extrabold text-emerald-900 ring-2 ring-emerald-200'
                  : isAvailable
                    ? editable
                      ? 'bg-emerald-50 font-bold text-emerald-700 hover:bg-emerald-100'
                      : 'font-bold text-[#272727] hover:bg-emerald-50 hover:text-emerald-700'
                    : inCurrentMonth
                      ? 'text-[#cbd5e1] line-through'
                      : 'text-[#dbe4ee]'
              } disabled:cursor-not-allowed`}
            >
              {date.getDate()}
              {isAvailable && !isSelected && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-emerald-500" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-[#eef2f7] pt-3 text-[10px] font-bold text-[#64748b]">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full border border-emerald-500 bg-emerald-100" />
          {editable ? 'Click to close' : 'Selected'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#cbd5e1]" />
          Unavailable
        </span>
      </div>
    </div>
  );
}
