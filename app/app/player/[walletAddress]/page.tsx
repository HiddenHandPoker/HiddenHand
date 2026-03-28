"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "@/components/WalletButton";
import { SoundToggle } from "@/components/SoundToggle";
import { NETWORK } from "@/contexts/WalletProvider";
import { StatCard } from "@/components/stats/StatCard";
import { ProfitChart } from "@/components/stats/ProfitChart";
import { RecentHands } from "@/components/stats/RecentHands";
import { OnChainBadge } from "@/components/stats/OnChainBadge";
import {
  usePlayerStats,
  getVPIP,
  getPFR,
  getAggressionFactor,
  getWinRate,
  getShowdownWinRate,
  getWinPercentage,
} from "@/hooks/usePlayerStats";
import { getDefaultToken, baseUnitsToDisplay } from "@/lib/tokens";

export default function PlayerProfilePage({
  params,
}: {
  params: Promise<{ walletAddress: string }>;
}) {
  const { walletAddress } = React.use(params);
  const { publicKey } = useWallet();
  const token = getDefaultToken();
  const [copied, setCopied] = useState(false);

  const {
    fetchStats,
    getPlayerStats,
    loading,
    progress,
    totalHandsTracked,
  } = usePlayerStats();

  // Fetch stats on mount
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const stats = getPlayerStats(walletAddress);
  const isOwnProfile = publicKey?.toString() === walletAddress;

  const shortAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-6)}`;
  const explorerBase = NETWORK === "devnet"
    ? "https://explorer.solana.com/address/"
    : "https://explorer.solana.com/address/";
  const explorerSuffix = NETWORK === "devnet" ? "?cluster=devnet" : "";
  const walletExplorerUrl = `${explorerBase}${walletAddress}${explorerSuffix}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Computed stats
  const vpip = stats ? getVPIP(stats) : 0;
  const pfr = stats ? getPFR(stats) : 0;
  const af = stats ? getAggressionFactor(stats) : null;
  const winRate = stats ? getWinRate(stats) : 0;
  const winRateDisplay = baseUnitsToDisplay(winRate, token);
  const sdWinRate = stats ? getShowdownWinRate(stats) : 0;
  const winPct = stats ? getWinPercentage(stats) : 0;
  const totalProfit = stats ? baseUnitsToDisplay(stats.totalProfit, token) : 0;
  const biggestPot = stats ? baseUnitsToDisplay(stats.biggestPotWon, token) : 0;

  const memberSince = stats && stats.firstHandTimestamp < Infinity
    ? new Date(stats.firstHandTimestamp * 1000).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : null;

  const afDisplay = af === null ? "—" : af === Infinity ? "∞" : af.toFixed(1);

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
        {/* Loading state */}
        {loading && (
          <div className="glass-dark rounded-xl p-6 mb-6 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-[var(--gold-main)] border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm text-[var(--text-secondary)]">
              Fetching on-chain hand history...
            </p>
            {progress && (
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Processing {progress.fetched} / {progress.total} transactions
              </p>
            )}
          </div>
        )}

        {/* Hero Section */}
        <div className="glass-dark rounded-2xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {isOwnProfile && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--felt-main)]/20 text-[var(--felt-highlight)] border border-[var(--felt-main)]/30 uppercase tracking-wider font-semibold">
                    Your Profile
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">
                  {shortAddress}
                </h2>
                <button
                  onClick={handleCopy}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  title="Copy wallet address"
                >
                  {copied ? (
                    <svg className="w-4 h-4 text-[var(--status-active)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
                <a
                  href={walletExplorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  title="View on Solana Explorer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <div className="text-[var(--text-primary)] font-bold text-xl">
                  {stats?.handsPlayed ?? 0}
                </div>
                <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider">
                  Hands
                </div>
              </div>
              <div className="text-center">
                <div
                  className={`font-bold text-xl ${
                    totalProfit >= 0
                      ? "text-[var(--status-active)]"
                      : "text-[var(--status-danger)]"
                  }`}
                >
                  {totalProfit >= 0 ? "+" : ""}
                  {totalProfit.toFixed(2)}
                </div>
                <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider">
                  {token.symbol} Profit
                </div>
              </div>
              {memberSince && (
                <div className="text-center">
                  <div className="text-[var(--text-primary)] font-bold text-xl">{memberSince}</div>
                  <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider">
                    Since
                  </div>
                </div>
              )}
            </div>
          </div>

          <OnChainBadge compact />
        </div>

        {/* No stats state */}
        {!loading && (!stats || stats.handsPlayed === 0) && (
          <div className="glass-dark rounded-xl p-8 text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="font-display text-lg font-bold text-[var(--text-primary)] mb-2">
              No Hands Recorded
            </h3>
            <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
              This player hasn&apos;t completed any hands yet.
              Stats will appear here after playing at a table.
            </p>
            {isOwnProfile && (
              <Link
                href="/lobby"
                className="btn-gold inline-block mt-4 px-6 py-2.5 rounded-xl text-sm"
              >
                Find a Table
              </Link>
            )}
          </div>
        )}

        {/* Stats Dashboard */}
        {stats && stats.handsPlayed > 0 && (
          <>
            {/* Stat Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatCard
                label="Hands Played"
                value={stats.handsPlayed}
                subValue={`${stats.handsWon} won (${winPct.toFixed(0)}%)`}
              />
              <StatCard
                label="Win Rate"
                value={`${winRateDisplay >= 0 ? "+" : ""}${winRateDisplay.toFixed(2)}`}
                subValue={`${token.symbol} / 100 hands`}
                color={winRateDisplay >= 0 ? "green" : "red"}
                tooltip="Profit per 100 hands played"
              />
              <StatCard
                label="VPIP"
                value={`${vpip.toFixed(1)}%`}
                subValue="Voluntarily Put $ In Pot"
                tooltip="Percentage of hands where this player voluntarily put money in the pot preflop (calls, raises, all-ins). Blinds don't count."
              />
              <StatCard
                label="PFR"
                value={`${pfr.toFixed(1)}%`}
                subValue="Pre-Flop Raise"
                tooltip="Percentage of hands where this player raised or went all-in preflop"
              />
              <StatCard
                label="SD Win %"
                value={`${sdWinRate.toFixed(1)}%`}
                subValue={`${stats.showdownWins}/${stats.showdownCount} showdowns`}
                tooltip="Win rate at showdown — when this player reaches showdown, how often do they win?"
              />
              <StatCard
                label="Aggression"
                value={afDisplay}
                subValue={`${stats.aggressiveActions} bets / ${stats.passiveActions} calls`}
                tooltip="Aggression Factor: (Raises + All-Ins) / Calls. Higher = more aggressive."
              />
              <StatCard
                label="Hands Won"
                value={stats.handsWon}
                subValue={`${stats.foldCount} folded`}
              />
              <StatCard
                label="Best Pot"
                value={biggestPot.toFixed(2)}
                subValue={token.symbol}
                color="gold"
                tooltip="Largest single pot won"
              />
            </div>

            {/* Profit Chart */}
            <div className="mb-6">
              <ProfitChart
                data={stats.profitTimeline}
                token={token}
                height={220}
              />
            </div>

            {/* Recent Hands */}
            <div className="mb-6">
              <RecentHands stats={stats} token={token} />
            </div>

            {/* On-Chain Verification */}
            <OnChainBadge />
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 w-full glass-dark py-4 text-center border-t border-white/5">
        <div className="flex items-center justify-center gap-4">
          <Link href="/lobby" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm transition-colors">
            Lobby
          </Link>
          <span className="text-white/10">|</span>
          <Link href="/leaderboard" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm transition-colors">
            Leaderboard
          </Link>
        </div>
      </footer>
    </main>
  );
}
