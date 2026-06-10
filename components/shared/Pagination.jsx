'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel = 'items'
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalItems <= pageSize) return null;

  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);
  const pageNumbers = [];

  for (let page = Math.max(1, safePage - 1); page <= Math.min(totalPages, safePage + 1); page += 1) {
    pageNumbers.push(page);
  }

  return (
    <nav
      aria-label={`${itemLabel} pagination`}
      className="flex flex-col gap-2 border-t border-[#e2e8f0] pt-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-xs font-medium text-[#475569]">
        Showing {start}-{end} of {totalItems} {itemLabel}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage === 1}
          aria-label="Go to previous page"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#dbe4ee] bg-white text-[#334155] transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pageNumbers.map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            aria-label={`Go to page ${page}`}
            aria-current={page === safePage ? 'page' : undefined}
            className={`h-8 min-w-8 rounded-lg px-2 text-xs font-bold transition ${
              page === safePage
                ? 'bg-emerald-600 text-white'
                : 'border border-[#dbe4ee] bg-white text-[#334155] hover:border-emerald-300 hover:text-emerald-700'
            }`}
          >
            {page}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage === totalPages}
          aria-label="Go to next page"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#dbe4ee] bg-white text-[#334155] transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
