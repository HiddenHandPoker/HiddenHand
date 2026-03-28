"use client";

import { FC } from "react";
import Link from "next/link";
import { type LobbyTable } from "@/hooks/useLobby";
import { getTokenByMint, getDefaultToken, baseUnitsToDisplay } from "@/lib/tokens";

interface TableRowProps {
  table: LobbyTable;
  isOwnTable?: boolean;
}

/**
 * Compact horizontal row for list view in the lobby.
 * Shows: name, stakes, players, buy-in, hands, status, action button.
 */
export const TableRow: FC<TableRowProps> = ({ table, isOwnTable = false }) => {
  const token = table.tokenMint
    ? getTokenByMint(table.tokenMint) ?? getDefaultToken()
    : getDefaultToken();
  const fmt = (v: number) => baseUnitsToDisplay(v, token).toFixed(2);
  const hasOpenSeats = table.currentPlayers < table.maxPlayers;
  const isPlaying = table.status === "Playing";

  return (
    <Link
      href={`/table/${encodeURIComponent(table.tableId)}`}
      className="group grid grid-cols-[1fr_auto_auto_auto_auto_auto] md:grid-cols-[2fr_1fr_1fr_1fr_80px_90px] gap-4 items-center px-5 py-3.5 hover:bg-white/[0.02] transition-colors border-b border-white/5 last:border-b-0"
    >
      {/* Table name + status */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            isPlaying ? "bg-[var(--status-active)]" : "bg-[var(--status-warning)]"
          }`}
        />
        <span className="text-[var(--text-primary)] text-sm font-medium truncate">
          {table.tableId}
        </span>
        {isOwnTable && (
          <span className="text-[var(--gold-main)] text-[10px] font-bold uppercase tracking-wider flex-shrink-0">
            Yours
          </span>
        )}
      </div>

      {/* Stakes */}
      <div className="text-sm text-[var(--text-secondary)] hidden md:block">
        {fmt(table.smallBlind)}/{fmt(table.bigBlind)}
        <span className="text-[var(--text-muted)] ml-1">{token.symbol}</span>
      </div>

      {/* Players with mini bar */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-[var(--text-primary)]">
          {table.currentPlayers}/{table.maxPlayers}
        </span>
        <div className="w-12 h-1.5 rounded-full bg-white/5 overflow-hidden hidden md:block">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${(table.currentPlayers / table.maxPlayers) * 100}%`,
              background:
                table.currentPlayers >= table.maxPlayers
                  ? "var(--status-danger)"
                  : table.currentPlayers >= table.maxPlayers / 2
                  ? "var(--felt-main)"
                  : "var(--status-warning)",
            }}
          />
        </div>
      </div>

      {/* Buy-in range */}
      <div className="text-sm text-[var(--text-muted)] hidden md:block">
        {fmt(table.minBuyIn)}-{fmt(table.maxBuyIn)}
      </div>

      {/* Hands played */}
      <div className="text-sm text-[var(--text-muted)] text-center hidden md:block">
        {table.handNumber}
      </div>

      {/* Action button */}
      <div className="text-right">
        <span
          className={`
            inline-block px-4 py-1.5 rounded-lg text-xs font-semibold transition-all
            ${
              hasOpenSeats
                ? "bg-[var(--gold-main)]/10 text-[var(--gold-light)] border border-[var(--gold-main)]/30 group-hover:bg-[var(--gold-main)]/20"
                : isPlaying
                ? "bg-purple-500/10 text-purple-400 border border-purple-500/30 group-hover:bg-purple-500/20"
                : "bg-white/5 text-[var(--text-muted)] border border-white/10"
            }
          `}
        >
          {hasOpenSeats ? "Join" : isPlaying ? "Watch" : "Full"}
        </span>
      </div>
    </Link>
  );
};
