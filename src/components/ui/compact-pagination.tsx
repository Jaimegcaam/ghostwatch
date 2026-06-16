"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { getPaginationRange } from "@/lib/pagination-range";

type CompactPaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
};

export function CompactPagination({
  page,
  totalPages,
  onPageChange,
  className = "",
}: CompactPaginationProps) {
  if (totalPages <= 1) return null;

  const items = getPaginationRange(page, totalPages);

  return (
    <div
      className={`flex items-center justify-center gap-1 ${className}`}
      role="navigation"
      aria-label="Pagination"
    >
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 0}
        aria-label="Previous page"
        className="flex h-7 w-7 items-center justify-center rounded-md border border-gw-border text-gw-fg-muted transition-colors hover:bg-gw-surface-hover disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>

      {items.map((item, index) =>
        item === "ellipsis" ? (
          <span
            key={`ellipsis-${index}`}
            className="flex h-7 w-5 items-center justify-center text-xs text-gw-fg-subtle"
            aria-hidden
          >
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-label={`Page ${item + 1}`}
            aria-current={page === item ? "page" : undefined}
            className={`flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 text-xs font-medium tabular-nums transition-colors ${
              page === item
                ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                : "border-gw-border bg-gw-surface text-gw-fg-muted hover:border-indigo-300 hover:bg-gw-surface-hover hover:text-gw-fg"
            }`}
          >
            {item + 1}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages - 1}
        aria-label="Next page"
        className="flex h-7 w-7 items-center justify-center rounded-md border border-gw-border text-gw-fg-muted transition-colors hover:bg-gw-surface-hover disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
