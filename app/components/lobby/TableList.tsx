"use client";

import { FC } from "react";
import { type LobbyTable } from "@/hooks/useLobby";
import { TableCard } from "./TableCard";

interface TableListProps {
  tables: LobbyTable[];
  loading: boolean;
  currentWallet?: string;
}

/** Skeleton card shown during loading state. */
const SkeletonCard: FC = () => (
  <div className="glass rounded-2xl p-5 animate-pulse">
    {/* Title skeleton */}
    <div className="flex items-start justify-between mb-4">
      <div className="h-5 w-32 rounded bg-[var(--bg-elevated)]" />
      <div className="h-4 w-16 rounded bg-[var(--bg-elevated)]" />
    </div>

    {/* Players bar skeleton */}
    <div className="mb-4">
      <div className="flex justify-between mb-1.5">
        <div className="h-3 w-12 rounded bg-[var(--bg-elevated)]" />
        <div className="h-3 w-8 rounded bg-[var(--bg-elevated)]" />
      </div>
      <div className="h-1.5 rounded-full bg-[var(--bg-dark)]">
        <div className="h-full w-1/3 rounded-full bg-[var(--bg-elevated)]" />
      </div>
    </div>

    {/* Stakes + buy-in skeleton */}
    <div className="grid grid-cols-2 gap-3 mb-4">
      <div>
        <div className="h-2.5 w-10 rounded bg-[var(--bg-elevated)] mb-1" />
        <div className="h-4 w-24 rounded bg-[var(--bg-elevated)]" />
      </div>
      <div>
        <div className="h-2.5 w-10 rounded bg-[var(--bg-elevated)] mb-1" />
        <div className="h-4 w-24 rounded bg-[var(--bg-elevated)]" />
      </div>
    </div>

    {/* Footer skeleton */}
    <div className="flex items-center justify-between">
      <div className="h-3 w-20 rounded bg-[var(--bg-elevated)]" />
      <div className="h-7 w-16 rounded-lg bg-[var(--bg-elevated)]" />
    </div>
  </div>
);

export const TableList: FC<TableListProps> = ({
  tables,
  loading,
  currentWallet,
}) => {
  // ------- Loading state -------
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
        {/* Empty table icon */}
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
          There are no active tables right now. Create the first table!
        </p>
      </div>
    );
  }

  // ------- Table grid -------
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
