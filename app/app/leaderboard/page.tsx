"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "@/components/WalletButton";
import { SoundToggle } from "@/components/SoundToggle";
import { NETWORK } from "@/contexts/WalletProvider";
import { OnChainBadge } from "@/components/stats/OnChainBadge";
import {
  usePlayerStats,
  type TimePeriod,
  type LeaderboardEntry,
  getVPIP,
  getWinRate,
  getWinPercentage,
} from "@/hooks/usePlayerStats";
import { getDefaultToken, baseUnitsToDisplay } from "@/lib/tokens";

const PERIOD_LABELS: { value: TimePeriod; label: string }[] = [
  { value: "all", label: "All-Time" },
  { value: "month", label: "This Month" },
  { value: "week", label: "This Week" },
];

const MIN_HANDS_FOR_LEADERBOARD = 3; // Lower threshold for early-stage game

export default function LeaderboardPage() {
  const { publicKey } = useWallet();
  const token = getDefaultToken();
  const [period, setPeriod] = useState<TimePeriod>("all");

  const {
    fetchStats,
    getLeaderboard,
    loading,
    progress,
    totalHandsTracked,
    totalPlayersTracked,
  } = usePlayerStats();

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const leaderboard = getLeaderboard(period, MIN_HANDS_FOR_LEADERBOARD);
  const currentWallet = publicKey?.toString();
  const currentPlayerRank = currentWallet
    ? leaderboard.findIndex(e => e.wallet === currentWallet) + 1
    : 0;

  return (
    <main className="min-h-screen relative">
      {/* Header */}
      <header className="glass-dark sticky top-0 z-50 px-6 py-4 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-4">
          <Link
            href="/lobby"
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <h1 className="font-display text-2xl font-bold tracking-wide">
            <span className="text-[var(--text-primary)]">Hidden</span>
            <span className="text-gold-gradient">Hand</span>
          </h1>
          <span
            className={`text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider font-semibold ${
              NETWORK === "localnet"
                ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                : "bg-[var(--gold-main)]/20 text-[var(--gold-light)] border border-[var(--gold-main)]/30"
            }`}
          >
            {NETWORK}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <SoundToggle />
          <WalletButton className="btn-gold !text-sm !px-5 !py-2.5 !rounded-xl" />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 pb-32 max-w-4xl">
        {/* Title */}
        <div className="mb-6">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-2">
            Leaderboard
          </h2>
          <p className="text-[var(--text-secondary)] text-sm">
            Rankings computed from on-chain hand results.{" "}
            <OnChainBadge compact />
          </p>
        </div>

        {/* Period tabs */}
        <div className="flex items-center gap-2 mb-6">
          {PERIOD_LABELS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                period === p.value
                  ? "bg-[var(--gold-main)]/20 text-[var(--gold-light)] border border-[var(--gold-main)]/40"
                  : "bg-[var(--bg-dark)] text-[var(--text-muted)] border border-white/5 hover:text-[var(--text-secondary)] hover:border-white/10"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Stats summary */}
        <div className="flex items-center gap-6 mb-4 text-sm">
          <span className="text-[var(--text-secondary)]">
            <span className="text-[var(--text-primary)] font-semibold">{totalHandsTracked}</span>{" "}
            hands tracked
          </span>
          <span className="text-white/10">|</span>
          <span className="text-[var(--text-secondary)]">
            <span className="text-[var(--text-primary)] font-semibold">{totalPlayersTracked}</span>{" "}
            players
          </span>
          {currentPlayerRank > 0 && (
            <>
              <span className="text-white/10">|</span>
              <span className="text-[var(--gold-light)]">
                Your rank: <span className="font-bold">#{currentPlayerRank}</span>
              </span>
            </>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="glass-dark rounded-xl p-6 text-center mb-6">
            <div className="animate-spin w-6 h-6 border-2 border-[var(--gold-main)] border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm text-[var(--text-secondary)]">
              Fetching on-chain data...
            </p>
            {progress && (
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Processing {progress.fetched} / {progress.total} transactions
              </p>
            )}
          </div>
        )}

        {/* Leaderboard table */}
        {loading ? null : leaderboard.length === 0 ? (
          <div className="glass-dark rounded-xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="font-display text-lg font-bold text-[var(--text-primary)] mb-2">
              No Rankings Yet
            </h3>
            <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
              Players need at least {MIN_HANDS_FOR_LEADERBOARD} completed hands to appear on the leaderboard.
              {period !== "all" && " Try switching to All-Time."}
            </p>
          </div>
        ) : (
          <>
          {/* Desktop table layout */}
          <div className="hidden md:block glass-dark rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[3rem_1fr_4.5rem_6rem_4.5rem_4.5rem] gap-2 px-4 py-3 text-[10px] uppercase tracking-wider text-[var(--text-muted)] border-b border-white/5">
              <div>#</div>
              <div>Player</div>
              <div className="text-right">Hands</div>
              <div className="text-right">Profit</div>
              <div className="text-right">Win %</div>
              <div className="text-right">VPIP</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-white/5">
              {leaderboard.map((entry) => (
                <LeaderboardRow
                  key={entry.wallet}
                  entry={entry}
                  isCurrentUser={entry.wallet === currentWallet}
                  token={token}
                />
              ))}
            </div>
          </div>

          {/* Mobile card layout */}
          <div className="md:hidden space-y-3">
            {leaderboard.map((entry) => (
              <MobileLeaderboardCard
                key={entry.wallet}
                entry={entry}
                isCurrentUser={entry.wallet === currentWallet}
                token={token}
              />
            ))}
          </div>
          </>
        )}

        {/* On-chain badge at bottom */}
        {leaderboard.length > 0 && (
          <div className="mt-6">
            <OnChainBadge />
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 w-full glass-dark py-4 text-center border-t border-white/5">
        <div className="flex items-center justify-center gap-4">
          <Link href="/lobby" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm transition-colors">
            Lobby
          </Link>
          <span className="text-white/10">|</span>
          <Link href="/leaderboard" className="text-[var(--gold-light)] text-sm font-medium">
            Leaderboard
          </Link>
        </div>
      </footer>
    </main>
  );
}

// ─── Leaderboard Row ───

function LeaderboardRow({
  entry,
  isCurrentUser,
  token,
}: {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
  token: ReturnType<typeof getDefaultToken>;
}) {
  const profit = baseUnitsToDisplay(entry.stats.totalProfit, token);
  const vpip = getVPIP(entry.stats);
  const winPct = getWinPercentage(entry.stats);
  const shortWallet = `${entry.wallet.slice(0, 4)}...${entry.wallet.slice(-4)}`;

  const rankDisplay = () => {
    if (entry.rank === 1) return <span className="text-[var(--gold-light)] font-bold text-lg">1</span>;
    if (entry.rank === 2) return <span className="text-gray-300 font-bold text-lg">2</span>;
    if (entry.rank === 3) return <span className="text-amber-600 font-bold text-lg">3</span>;
    return <span className="text-[var(--text-muted)]">{entry.rank}</span>;
  };

  return (
    <Link
      href={`/player/${entry.wallet}`}
      className={`grid grid-cols-[3rem_1fr_4.5rem_6rem_4.5rem_4.5rem] gap-2 px-4 py-3 items-center hover:bg-white/5 transition-colors ${
        isCurrentUser ? "bg-[var(--gold-main)]/5 border-l-2 border-[var(--gold-main)]" : ""
      } ${entry.rank <= 3 ? "bg-white/[0.02]" : ""}`}
    >
      <div className="flex items-center justify-center">
        {rankDisplay()}
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`text-sm font-medium truncate ${isCurrentUser ? "text-[var(--gold-light)]" : "text-[var(--text-primary)]"}`}>
          {isCurrentUser ? "You" : shortWallet}
        </span>
        {isCurrentUser && (
          <span className="text-[10px] text-[var(--gold-main)] font-mono">{shortWallet}</span>
        )}
      </div>
      <div className="text-right text-sm text-[var(--text-secondary)]">
        {entry.stats.handsPlayed}
      </div>
      <div className={`text-right text-sm font-semibold ${profit >= 0 ? "text-[var(--status-active)]" : "text-[var(--status-danger)]"}`}>
        {profit >= 0 ? "+" : ""}{profit.toFixed(2)}
      </div>
      <div className="text-right text-sm text-[var(--text-secondary)]">
        {winPct.toFixed(0)}%
      </div>
      <div className="text-right text-sm text-[var(--text-secondary)]">
        {vpip.toFixed(0)}%
      </div>
    </Link>
  );
}

// ─── Mobile Leaderboard Card ───

function MobileLeaderboardCard({
  entry,
  isCurrentUser,
  token,
}: {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
  token: ReturnType<typeof getDefaultToken>;
}) {
  const profit = baseUnitsToDisplay(entry.stats.totalProfit, token);
  const vpip = getVPIP(entry.stats);
  const winPct = getWinPercentage(entry.stats);
  const shortWallet = `${entry.wallet.slice(0, 4)}...${entry.wallet.slice(-4)}`;

  const rankBorder =
    entry.rank === 1 ? "border-[var(--gold-light)]/50" :
    entry.rank === 2 ? "border-gray-300/30" :
    entry.rank === 3 ? "border-amber-600/30" :
    "border-white/5";

  const rankBg =
    entry.rank === 1 ? "bg-[var(--gold-main)]/10" :
    entry.rank === 2 ? "bg-gray-300/5" :
    entry.rank === 3 ? "bg-amber-600/5" :
    "";

  return (
    <Link
      href={`/player/${entry.wallet}`}
      className={`glass-dark rounded-xl p-4 border ${rankBorder} ${rankBg} ${
        isCurrentUser ? "ring-1 ring-[var(--gold-main)]/40" : ""
      } block`}
    >
      {/* Top row: rank + wallet + profit */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className={`text-lg font-bold w-8 text-center ${
            entry.rank === 1 ? "text-[var(--gold-light)]" :
            entry.rank === 2 ? "text-gray-300" :
            entry.rank === 3 ? "text-amber-600" :
            "text-[var(--text-muted)]"
          }`}>
            #{entry.rank}
          </span>
          <span className={`text-sm font-medium ${isCurrentUser ? "text-[var(--gold-light)]" : "text-[var(--text-primary)]"}`}>
            {isCurrentUser ? "You" : shortWallet}
          </span>
          {isCurrentUser && (
            <span className="text-[10px] text-[var(--gold-main)] font-mono">{shortWallet}</span>
          )}
        </div>
        <span className={`text-sm font-bold ${profit >= 0 ? "text-[var(--status-active)]" : "text-[var(--status-danger)]"}`}>
          {profit >= 0 ? "+" : ""}{profit.toFixed(2)}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Hands</div>
          <div className="text-sm font-medium text-[var(--text-primary)]">{entry.stats.handsPlayed}</div>
        </div>
        <div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Win %</div>
          <div className="text-sm font-medium text-[var(--text-primary)]">{winPct.toFixed(0)}%</div>
        </div>
        <div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">VPIP</div>
          <div className="text-sm font-medium text-[var(--text-primary)]">{vpip.toFixed(0)}%</div>
        </div>
      </div>
    </Link>
  );
}
