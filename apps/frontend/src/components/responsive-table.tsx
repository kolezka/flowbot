"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Column<T> {
  /** Header label displayed in table head and mobile card label */
  header: string;
  /** Key of the data object, or a function that returns the value */
  accessor: keyof T | ((row: T) => React.ReactNode);
  /** Optional custom render function */
  render?: (value: unknown, row: T) => React.ReactNode;
  /** Hide this column on mobile cards (it will still show in the desktop table) */
  hideOnMobile?: boolean;
  /** Additional className for the table header cell */
  headerClassName?: string;
  /** Additional className for the table body cell */
  cellClassName?: string;
}

export interface ResponsiveTableProps<T> {
  columns: Column<T>[];
  data: T[];
  /** Unique key extractor for each row */
  keyExtractor: (row: T) => string;
  /** Optional click handler for a row / card */
  onRowClick?: (row: T) => void;
  /** Loading state */
  loading?: boolean;
  /** Message to display when data is empty */
  emptyMessage?: string;
  /** Additional className for the wrapper */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCellValue<T>(row: T, column: Column<T>): React.ReactNode {
  const raw =
    typeof column.accessor === "function"
      ? column.accessor(row)
      : row[column.accessor];

  if (column.render) {
    return column.render(raw, row);
  }

  // Fallback: render primitives directly
  if (raw === null || raw === undefined) return "-";
  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
    return String(raw);
  }
  // React nodes (JSX) pass through
  return raw as React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ResponsiveTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  loading = false,
  emptyMessage = "No data found",
  className,
}: ResponsiveTableProps<T>) {
  // --- Loading state ---
  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        {/* Desktop skeleton */}
        <div className="hidden md:block rounded-md border">
          <div className="animate-pulse p-4 space-y-3">
            <div className="h-4 bg-muted rounded w-full" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted/60 rounded w-full" />
            ))}
          </div>
        </div>
        {/* Mobile skeleton */}
        <div className="md:hidden space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border bg-card p-4 space-y-2">
              <div className="h-4 bg-muted rounded w-2/3" />
              <div className="h-3 bg-muted/60 rounded w-full" />
              <div className="h-3 bg-muted/60 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- Empty state ---
  if (data.length === 0) {
    return (
      <div className={cn("rounded-md border", className)}>
        <div className="flex h-24 items-center justify-center text-muted-foreground">
          {emptyMessage}
        </div>
      </div>
    );
  }

  const clickable = !!onRowClick;

  return (
    <div className={className}>
      {/* ----------------------------------------------------------------- */}
      {/* Desktop: normal HTML table (visible md+) */}
      {/* ----------------------------------------------------------------- */}
      <div className="hidden md:block rounded-md border">
        <table className="w-full caption-bottom text-sm">
          <thead className="[&_tr]:border-b">
            <tr className="border-b transition-colors hover:bg-muted/50">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={cn(
                    "h-10 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
                    col.headerClassName,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {data.map((row) => (
              <tr
                key={keyExtractor(row)}
                onClick={clickable ? () => onRowClick!(row) : undefined}
                className={cn(
                  "border-b transition-colors hover:bg-muted/50",
                  clickable && "cursor-pointer",
                )}
              >
                {columns.map((col, idx) => (
                  <td
                    key={idx}
                    className={cn(
                      "p-4 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
                      col.cellClassName,
                    )}
                  >
                    {getCellValue(row, col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Mobile: card layout (visible <md) */}
      {/* ----------------------------------------------------------------- */}
      <div className="md:hidden space-y-3">
        {data.map((row) => (
          <div
            key={keyExtractor(row)}
            onClick={clickable ? () => onRowClick!(row) : undefined}
            className={cn(
              "rounded-xl border bg-card p-4 shadow-sm transition-colors",
              clickable && "cursor-pointer hover:bg-accent/50 active:bg-accent",
            )}
          >
            <div className="space-y-2">
              {columns
                .filter((col) => !col.hideOnMobile)
                .map((col, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground shrink-0">
                      {col.header}
                    </span>
                    <span className="text-sm text-right">{getCellValue(row, col)}</span>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
