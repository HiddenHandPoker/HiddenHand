"use client";

import { FC } from "react";
import Link from "next/link";
import { type LobbyTable } from "@/hooks/useLobby";
import { getTokenByMint, getDefaultToken, baseUnitsToDisplay } from "@/lib/tokens";
import { PublicKey } from "@solana/web3.js";

interface TableCardProps {
  table: LobbyTable;
  isOwnTable?: boolean;
}

/**
 * Format a token amount for display, trimming unnecessary trailing zeros.
 * e.g. 0.01 -> "0.01", 1.0 -> "1", 0.001 -> "0.001"
 */
function formatDisplay(baseUnits: number, decimals: number): string {
  const amount = baseUnits / Math.pow(10, decimals);
  return parseFloat(amount.toFixed(4)).toString();
}

export const TableCard: FC<TableCardProps> = ({ table, isOwnTable }) => {
  const isWaiting = table.status === "Waiting";
  const fillPercent = (table.currentPlayers / table.maxPlayers) * 100;

  // Resolve the table's token info
  const tokenMintStr = (table as { tokenMint?: string }).tokenMint;
  const token = tokenMintStr
    ? getTokenByMint(tokenMintStr) ?? getDefaultToken()
    : getDefaultToken();
  const fmt = (baseUnits: number) => formatDisplay(baseUnits, token.decimals);

  return (
    <Link
      href={`/table/${encodeURIComponent(table.tableId)}`}
      className="block group"
    >
      <div className="glass rounded-2xl p-5 relative overflow-hidden transition-all duration-300 hover:border-[var(--gold-main)] hover:shadow-[0_0_24px_rgba(212,160,18,0.15)]">
        {/* Subtle top glow on hover */}
        <div
          className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background:
              "radial-gradient(ellipse at top, rgba(212, 160, 18, 0.08) 0%, transparent 60%)",
          }}
        />

        <div className="relative">
          {/* Header row: name + status */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <h3 className="font-display text-lg font-bold text-[var(--text-primary)] truncate leading-tight">
              {table.tableId}
            </h3>

            <div className="flex items-center gap-2 shrink-0">
              {isOwnTable && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--gold-main)]/15 text-[var(--gold-light)] border border-[var(--gold-main)]/30">
                  Your table
                </span>
              )}
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isWaiting
                      ? "bg-[var(--status-active)]"
                      : "bg-[var(--status-warning)]"
                  }`}
                />
                <span className="text-[var(--text-secondary)]">
                  {table.status}
                </span>
              </span>
            </div>
          </div>

          {/* Players bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                Players
              </span>
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {table.currentPlayers}/{table.maxPlayers}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--bg-dark)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${fillPercent}%`,
                  background:
                    fillPercent === 100
                      ? "var(--status-danger)"
                      : "linear-gradient(90deg, var(--felt-main), var(--felt-highlight))",
                }}
              />
            </div>
          </div>

          {/* Stakes + buy-in */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <span className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">
                Stakes
              </span>
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                ${fmt(table.smallBlind)} /{" "}
                ${fmt(table.bigBlind)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">
                Buy-in
              </span>
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                ${fmt(table.minBuyIn)} -{" "}
                ${fmt(table.maxBuyIn)}
              </span>
            </div>
          </div>

          {/* Footer: hands played + rake + join button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--text-muted)]">
                {table.handNumber} hand{table.handNumber !== 1 ? "s" : ""}{" "}
                played
              </span>
              {table.rakeBps > 0 && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--status-warning)]/10 text-[var(--status-warning)] border border-[var(--status-warning)]/20">
                  {(table.rakeBps / 100).toFixed(table.rakeBps % 100 === 0 ? 0 : 1)}% rake
                </span>
              )}
            </div>

            <span className="btn-gold px-4 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 group-hover:shadow-[0_0_12px_rgba(212,160,18,0.3)] transition-shadow">
              Join
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-3.5 h-3.5"
              >
                <path
                  fillRule="evenodd"
                  d="M3 10a.75.75 0 0 1 .75-.75h10.638l-3.96-3.96a.75.75 0 1 1 1.06-1.06l5.25 5.25a.75.75 0 0 1 0 1.06l-5.25 5.25a.75.75 0 1 1-1.06-1.06l3.96-3.96H3.75A.75.75 0 0 1 3 10Z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};
