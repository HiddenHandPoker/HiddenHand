"use client";

import { FC } from "react";
import { type PlayerStats } from "@/hooks/usePlayerStats";
import { type TokenInfo, getDefaultToken, baseUnitsToDisplay } from "@/lib/tokens";

interface RecentHandsProps {
  stats: PlayerStats;
  token?: TokenInfo;
  maxHands?: number;
}

export const RecentHands: FC<RecentHandsProps> = ({
  stats,
  token = getDefaultToken(),
  maxHands = 20,
}) => {
  // profitTimeline is chronological — show most recent first
  const recentHands = [...stats.profitTimeline].reverse().slice(0, maxHands);

  if (recentHands.length === 0) {
    return (
      <div className="glass-dark rounded-xl p-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
          Recent Hands
        </h3>
        <p className="text-sm text-[var(--text-muted)]">No hands recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="glass-dark rounded-xl p-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
        Recent Hands
      </h3>
      <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
        {recentHands.map((hand, i) => {
          const profitDisplay = baseUnitsToDisplay(hand.profit, token);
          const isWin = hand.profit > 0;
          const isBreakEven = hand.profit === 0;

          return (
            <div
              key={`${hand.handNumber}-${i}`}
              className="flex items-center justify-between py-2 px-3 rounded-lg bg-black/20 hover:bg-black/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--text-muted)] font-mono w-16">
                  #{hand.handNumber}
                </span>
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    isWin
                      ? "bg-[var(--status-active)]"
                      : isBreakEven
                      ? "bg-[var(--text-muted)]"
                      : "bg-[var(--status-danger)]"
                  }`}
                />
              </div>
              <span
                className={`text-sm font-semibold font-mono ${
                  isWin
                    ? "text-[var(--status-active)]"
                    : isBreakEven
                    ? "text-[var(--text-muted)]"
                    : "text-[var(--status-danger)]"
                }`}
              >
                {isWin ? "+" : ""}{profitDisplay.toFixed(2)} {token.symbol}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
