"use client";

import { FC } from "react";
import Link from "next/link";
import {
  type PlayerStats,
  getVPIP,
  getPFR,
  getWinRate,
  getShowdownWinRate,
} from "@/hooks/usePlayerStats";
import { type TokenInfo, getDefaultToken, baseUnitsToDisplay } from "@/lib/tokens";

interface PlayerHUDProps {
  wallet: string;
  stats: PlayerStats | null;
  token?: TokenInfo;
  loading?: boolean;
}

export const PlayerHUD: FC<PlayerHUDProps> = ({
  wallet,
  stats,
  token = getDefaultToken(),
  loading = false,
}) => {
  const shortAddress = `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;

  if (loading) {
    return (
      <div className="glass-dark rounded-xl p-3 min-w-[180px] animate-pulse">
        <div className="h-3 bg-white/5 rounded w-20 mb-2" />
        <div className="h-3 bg-white/5 rounded w-28 mb-1" />
        <div className="h-3 bg-white/5 rounded w-24" />
      </div>
    );
  }

  if (!stats || stats.handsPlayed === 0) {
    return (
      <div className="glass-dark rounded-xl p-3 min-w-[180px]">
        <p className="text-xs text-[var(--text-secondary)] font-medium mb-1">{shortAddress}</p>
        <p className="text-[10px] text-[var(--text-muted)]">No stats available</p>
        <Link
          href={`/player/${wallet}`}
          className="text-[10px] text-[var(--felt-highlight)] hover:text-[var(--felt-light)] mt-1 inline-block"
        >
          View Profile
        </Link>
      </div>
    );
  }

  const vpip = getVPIP(stats);
  const pfr = getPFR(stats);
  const winRate = getWinRate(stats);
  const winRateDisplay = baseUnitsToDisplay(winRate, token);
  const sdWinRate = getShowdownWinRate(stats);

  return (
    <div className="glass-dark rounded-xl p-3 min-w-[180px]">
      <p className="text-xs text-[var(--text-secondary)] font-medium mb-2">{shortAddress}</p>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] mb-2">
        <div className="flex justify-between">
          <span className="text-[var(--text-muted)]">Hands</span>
          <span className="text-[var(--text-primary)] font-medium">{stats.handsPlayed}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--text-muted)]">VPIP</span>
          <span className={`font-medium ${vpip > 35 ? "text-[var(--status-danger)]" : vpip < 15 ? "text-blue-400" : "text-[var(--text-primary)]"}`}>
            {vpip.toFixed(0)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--text-muted)]">PFR</span>
          <span className="text-[var(--text-primary)] font-medium">{pfr.toFixed(0)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--text-muted)]">SD Win</span>
          <span className="text-[var(--text-primary)] font-medium">{sdWinRate.toFixed(0)}%</span>
        </div>
      </div>

      <div className="border-t border-white/5 pt-1.5 mb-1.5">
        <div className="flex justify-between text-[10px]">
          <span className="text-[var(--text-muted)]">Win Rate</span>
          <span className={`font-semibold ${winRateDisplay >= 0 ? "text-[var(--status-active)]" : "text-[var(--status-danger)]"}`}>
            {winRateDisplay >= 0 ? "+" : ""}{winRateDisplay.toFixed(2)}/100
          </span>
        </div>
      </div>

      <Link
        href={`/player/${wallet}`}
        className="text-[10px] text-[var(--felt-highlight)] hover:text-[var(--felt-light)] transition-colors inline-flex items-center gap-0.5"
      >
        View Profile
        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
};
