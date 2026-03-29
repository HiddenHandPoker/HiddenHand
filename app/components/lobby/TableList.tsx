"use client";

import { FC } from "react";
import { type LobbyTable } from "@/hooks/useLobby";
import { TableCard } from "./TableCard";
import { TableRow } from "./TableRow";

export type ViewMode = "grid" | "list";

interface TableListProps {
  tables: LobbyTable[];
  loading: boolean;
  currentWallet?: string;
  viewMode?: ViewMode;
}

/** Shimmer block used by skeleton loaders. */
const Shimmer: FC<{ className?: string }> = ({ className = "" }) => (
  <div
    className={`rounded ${className}`}
    style={{
      background: "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
    }}
  />
);

/** Skeleton card shown during loading state. */
const SkeletonCard: FC = () => (
  <div className="glass rounded-2xl p-5">
    <div className="flex items-start justify-between mb-4">
      <Shimmer className="h-5 w-32" />
      <Shimmer className="h-4 w-16" />
    </div>
    <div className="mb-4">
      <div className="flex justify-between mb-1.5">
        <Shimmer className="h-3 w-12" />
        <Shimmer className="h-3 w-8" />
      </div>
      <div className="h-1.5 rounded-full bg-[var(--bg-dark)]">
        <Shimmer className="h-full w-1/3 !rounded-full" />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3 mb-4">
      <div>
        <Shimmer className="h-2.5 w-10 mb-1" />
        <Shimmer className="h-4 w-24" />
      </div>
      <div>
        <Shimmer className="h-2.5 w-10 mb-1" />
        <Shimmer className="h-4 w-24" />
      </div>
    </div>
    <div className="flex items-center justify-between">
      <Shimmer className="h-3 w-20" />
      <Shimmer className="h-7 w-16 !rounded-lg" />
    </div>
  </div>
);

/** Skeleton row for list view loading. */
const SkeletonRow: FC = () => (
  <div className="flex items-center gap-4 px-5 py-3.5 border-b border-white/5">
    <Shimmer className="h-4 w-32" />
    <Shimmer className="h-4 w-20" />
    <Shimmer className="h-4 w-12" />
    <Shimmer className="h-4 w-16 ml-auto" />
  </div>
);

export const TableList: FC<TableListProps> = ({
  tables,
  loading,
  currentWallet,
  viewMode = "grid",
}) => {
  // ------- Loading state -------
  if (loading) {
    if (viewMode === "list") {
      return (
        <div className="glass rounded-2xl overflow-hidden">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  // ------- Empty state -------
  if (tables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center mb-5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.2}
            stroke="currentColor"
            className="w-10 h-10 text-[var(--text-muted)]"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z"
            />
          </svg>
        </div>
        <h3 className="font-display text-xl font-bold text-[var(--text-primary)] mb-2">
          No tables found
        </h3>
        <p className="text-[var(--text-secondary)] text-sm max-w-xs">
          There are no active tables matching your filters. Create the first table or try Quick Play!
        </p>
      </div>
    );
  }

  // ------- List view -------
  if (viewMode === "list") {
    return (
      <div className="glass rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] md:grid-cols-[2fr_1fr_1fr_1fr_80px_90px] gap-4 px-5 py-3 border-b border-white/10">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Table
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] hidden md:block">
            Stakes
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Players
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] hidden md:block">
            Buy-in
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] text-center hidden md:block">
            Hands
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] text-right">
            Action
          </span>
        </div>
        {/* Rows */}
        {tables.map((table) => (
          <TableRow
            key={table.publicKey.toString()}
            table={table}
            isOwnTable={
              !!currentWallet && table.authority.toString() === currentWallet
            }
          />
        ))}
      </div>
    );
  }

  // ------- Grid view (default) -------
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {tables.map((table) => (
        <TableCard
          key={table.publicKey.toString()}
          table={table}
          isOwnTable={
            !!currentWallet &&
            table.authority.toString() === currentWallet
          }
        />
      ))}
    </div>
  );
};
