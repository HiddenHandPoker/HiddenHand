"use client";

import { FC, useEffect, useRef } from "react";
import { CardHand } from "./Card";
import {
  HandHistoryEntry,
  TimelineEvent,
} from "@/hooks/useHandHistory";
import {
  useReplayState,
  type SpeedMultiplier,
  type ReplayPlayerState,
} from "@/hooks/useReplayState";
import { type TokenInfo, getDefaultToken, baseUnitsToDisplay } from "@/lib/tokens";

// ---------------------------------------------------------------------------
// Seat positions (same geometry as PokerTable, for 6-max)
// ---------------------------------------------------------------------------

const SEAT_POSITIONS = [
  { top: "86%", left: "50%" },  // Bottom center
  { top: "70%", left: "14%" },  // Bottom left
  { top: "30%", left: "14%" },  // Top left
  { top: "14%", left: "50%" },  // Top center
  { top: "30%", left: "86%" },  // Top right
  { top: "70%", left: "86%" },  // Bottom right
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HandReplayerProps {
  hand: HandHistoryEntry;
  timeline: TimelineEvent[];
  token?: TokenInfo;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const HandReplayer: FC<HandReplayerProps> = ({
  hand,
  timeline,
  token = getDefaultToken(),
  onClose,
}) => {
  const {
    currentStep,
    totalSteps,
    isPlaying,
    speed,
    tableState,
    annotation,
    stepForward,
    stepBackward,
    jumpToStart,
    jumpToEnd,
    togglePlay,
    setPlaybackSpeed,
  } = useReplayState(hand, timeline, token);

  const fmt = (v: number) => baseUnitsToDisplay(v, token).toFixed(2);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  const sbPosition = tableState.smallBlindSeat;
  const bbPosition = tableState.bigBlindSeat;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="relative w-full max-w-[900px] glass-dark rounded-2xl overflow-hidden"
        style={{
          border: "1px solid rgba(212, 160, 18, 0.2)",
          boxShadow: "0 0 60px rgba(0,0,0,0.5), 0 0 20px rgba(212, 160, 18, 0.1)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            {/* Replay icon */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, rgba(212,160,18,0.2) 0%, rgba(212,160,18,0.05) 100%)",
                border: "1px solid rgba(212,160,18,0.3)",
              }}
            >
              <svg className="w-4 h-4 text-[var(--gold-light)]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Hand #{hand.handNumber} Replay
              </h3>
              <p className="text-[10px] text-[var(--text-muted)]">
                {hand.players.length} players &middot; Pot {fmt(hand.totalPot)} {token.symbol}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mini Poker Table */}
        <div className="relative w-full aspect-[16/10] mx-auto" style={{ maxHeight: "420px" }}>
          {/* Table felt */}
          <div
            className="absolute inset-6 rounded-[45%]"
            style={{
              background: "linear-gradient(135deg, #3d2914 0%, #5c3d1e 20%, #7a4f24 40%, #5c3d1e 60%, #3d2914 80%, #2a1c0e 100%)",
              boxShadow: "0 10px 40px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.1)",
            }}
          >
            {/* Gold trim */}
            <div
              className="absolute inset-2 rounded-[43%]"
              style={{ border: "1px solid rgba(212, 160, 18, 0.25)" }}
            />
          </div>

          {/* Felt surface */}
          <div
            className="absolute inset-10 rounded-[42%] overflow-hidden"
            style={{
              backgroundImage: "url('/hiddenhand-table-bg.webp')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              boxShadow: "inset 0 4px 20px rgba(0,0,0,0.4)",
            }}
          >
            {/* Center spotlight */}
            <div
              className="absolute inset-0"
              style={{
                background: "radial-gradient(ellipse at center 40%, rgba(255,255,255,0.06) 0%, transparent 50%)",
              }}
            />

            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {/* Pot */}
              <div
                className={`glass rounded-xl px-5 py-2 mb-3 ${tableState.pot > 0 ? "animate-pulse-gold" : ""}`}
                style={tableState.pot > 0 ? {
                  boxShadow: "0 0 20px rgba(212, 160, 18, 0.2)",
                } : undefined}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider">Pot</span>
                  <span className="text-gold-gradient font-display text-xl font-bold">
                    {fmt(tableState.pot)}
                  </span>
                  <span className="text-[var(--gold-light)] text-sm">{token.symbol}</span>
                </div>
              </div>

              {/* Community cards */}
              <div className="relative px-3 py-2">
                <div
                  className="absolute inset-0 rounded-lg"
                  style={{ background: "rgba(0,0,0,0.15)" }}
                />
                <div className="relative flex gap-2">
                  {[0, 1, 2, 3, 4].map((idx) => {
                    const card = tableState.communityCards[idx];
                    return (
                      <div
                        key={idx}
                        className={`transition-all duration-300 ${
                          card !== undefined ? "replay-card-enter" : ""
                        }`}
                      >
                        {card !== undefined ? (
                          <CardHand cards={[card]} size="sm" dealt />
                        ) : (
                          <div
                            className="w-12 h-[4.2rem] rounded-md border border-dashed flex items-center justify-center"
                            style={{
                              borderColor: "rgba(255,255,255,0.08)",
                              background: "rgba(0,0,0,0.1)",
                            }}
                          >
                            <span className="text-[var(--text-muted)] text-[8px] opacity-40">
                              {idx < 3 ? (idx === 1 ? "FLOP" : "") : idx === 3 ? "TURN" : "RIVER"}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Phase badge */}
              <div className="mt-3">
                <div
                  className={`
                    px-4 py-1.5 rounded-full uppercase tracking-widest text-xs font-semibold transition-all duration-200
                    ${tableState.phase === "Showdown" || tableState.phase === "Settled"
                      ? "bg-[var(--gold-main)] text-black"
                      : "glass text-[var(--gold-light)]"
                    }
                  `}
                >
                  {tableState.phase}
                </div>
              </div>
            </div>
          </div>

          {/* Player seats */}
          {SEAT_POSITIONS.map((pos, idx) => {
            const player = tableState.players.find((p) => p.seatIndex === idx);
            if (!player || player.status === "empty") return null;

            const isWinner = tableState.winnerSeats.includes(idx);
            const isActive =
              tableState.actionOn === idx &&
              tableState.phase !== "Showdown" &&
              tableState.phase !== "Settled" &&
              tableState.phase !== "Dealing";
            const isFolded = player.status === "folded";
            const isDealer = tableState.dealerPosition === idx;
            const isSB = sbPosition === idx;
            const isBB = bbPosition === idx;

            return (
              <div
                key={idx}
                className="absolute"
                style={{
                  top: pos.top,
                  left: pos.left,
                  transform: "translate(-50%, -50%)",
                  width: "120px",
                }}
              >
                <ReplaySeat
                  player={player}
                  isActive={isActive}
                  isFolded={isFolded}
                  isWinner={isWinner}
                  isDealer={isDealer}
                  isSB={isSB}
                  isBB={isBB}
                  isFinalStep={tableState.isFinalStep}
                  token={token}
                />
              </div>
            );
          })}
        </div>

        {/* Action annotation */}
        <div className="px-5 py-2 border-t border-white/5">
          <p className="text-xs text-center text-[var(--text-secondary)] min-h-[1.25rem] transition-all duration-200">
            {annotation}
          </p>
        </div>

        {/* Privacy narrative */}
        {tableState.phase !== "Showdown" &&
         tableState.phase !== "Settled" &&
         tableState.phase !== "Dealing" && (
          <div className="px-5 pb-1">
            <p className="text-[10px] text-center text-cyan-400/60">
              Cards encrypted on-chain during this hand. Only revealed at showdown with cryptographic proof.
            </p>
          </div>
        )}

        {/* Transport controls */}
        <div className="px-5 py-3 border-t border-white/5">
          <div className="flex items-center justify-between gap-4">
            {/* Step counter */}
            <div className="text-xs text-[var(--text-muted)] min-w-[80px]">
              Step{" "}
              <span className="font-mono text-[var(--text-secondary)]">
                {currentStep + 1}
              </span>
              <span className="font-mono"> / {totalSteps}</span>
            </div>

            {/* Transport buttons */}
            <div className="flex items-center gap-1">
              <TransportButton
                onClick={jumpToStart}
                disabled={currentStep === 0}
                title="Jump to start (Home)"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414zm-6 0a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L5.414 10l4.293 4.293a1 1 0 010 1.414z" />
                </svg>
              </TransportButton>

              <TransportButton
                onClick={stepBackward}
                disabled={currentStep === 0}
                title="Step back (Left arrow)"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </TransportButton>

              {/* Play/Pause — bigger */}
              <button
                onClick={togglePlay}
                className={`
                  w-12 h-12 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-150 touch-target
                  ${isPlaying
                    ? "bg-[var(--gold-main)] text-black hover:bg-[var(--gold-light)]"
                    : "bg-white/10 text-[var(--text-primary)] hover:bg-white/20"
                  }
                `}
                title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              >
                {isPlaying ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              <TransportButton
                onClick={stepForward}
                disabled={currentStep >= totalSteps - 1}
                title="Step forward (Right arrow)"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </TransportButton>

              <TransportButton
                onClick={jumpToEnd}
                disabled={currentStep >= totalSteps - 1}
                title="Jump to end (End)"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4.293 15.707a1 1 0 010-1.414L8.586 10 4.293 5.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0zm6 0a1 1 0 010-1.414L14.586 10l-4.293-4.293a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" />
                </svg>
              </TransportButton>
            </div>

            {/* Speed selector */}
            <div className="flex items-center gap-1 min-w-[80px] justify-end">
              {([0.5, 1, 2] as SpeedMultiplier[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setPlaybackSpeed(s)}
                  className={`
                    px-2 py-1 rounded text-[10px] font-semibold transition-all duration-150
                    ${speed === s
                      ? "bg-[var(--gold-main)] text-black"
                      : "bg-white/5 text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--text-secondary)]"
                    }
                  `}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${((currentStep + 1) / totalSteps) * 100}%`,
                background: "linear-gradient(90deg, var(--gold-dark), var(--gold-main), var(--gold-light))",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Transport button (reusable)
// ---------------------------------------------------------------------------

const TransportButton: FC<{
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}> = ({ onClick, disabled, title, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`
      w-10 h-10 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all duration-150 touch-target
      ${disabled
        ? "text-[var(--text-muted)] opacity-40 cursor-not-allowed"
        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/10"
      }
    `}
  >
    {children}
  </button>
);

// ---------------------------------------------------------------------------
// Replay Seat (mini player seat for the replayer)
// ---------------------------------------------------------------------------

const ReplaySeat: FC<{
  player: ReplayPlayerState;
  isActive: boolean;
  isFolded: boolean;
  isWinner: boolean;
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
  isFinalStep: boolean;
  token: TokenInfo;
}> = ({
  player,
  isActive,
  isFolded,
  isWinner,
  isDealer,
  isSB,
  isBB,
  isFinalStep,
  token,
}) => {
  const fmt = (v: number) => baseUnitsToDisplay(v, token).toFixed(2);
  const shortAddr = player.player
    ? `${player.player.slice(0, 4)}...${player.player.slice(-4)}`
    : "";

  // Position badges
  const badges: { label: string; cls: string }[] = [];
  if (isDealer) badges.push({ label: "D", cls: "bg-gradient-to-br from-[var(--gold-light)] to-[var(--gold-dark)] text-black shadow-[0_0_8px_var(--gold-glow)]" });
  if (isSB) badges.push({ label: "SB", cls: "bg-gradient-to-br from-[var(--chip-blue)] to-blue-700 text-white" });
  if (isBB) badges.push({ label: "BB", cls: "bg-gradient-to-br from-[var(--chip-red)] to-red-800 text-white" });

  return (
    <div
      className={`
        relative p-2 rounded-xl transition-all duration-300
        glass-dark
        ${isActive ? "replay-active-seat" : ""}
        ${isFolded ? "opacity-40" : ""}
        ${isWinner ? "replay-winner-seat" : ""}
      `}
    >
      {/* Winner glow */}
      {isWinner && (
        <div
          className="absolute -inset-1 rounded-xl pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at center, rgba(212, 160, 18, 0.3) 0%, transparent 70%)",
            animation: "win-glow-pulse 1.5s ease-in-out infinite",
          }}
        />
      )}

      {/* Active player glow */}
      {isActive && (
        <div
          className="absolute -inset-0.5 rounded-xl pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at center, rgba(212, 160, 18, 0.15) 0%, transparent 70%)",
          }}
        />
      )}

      {/* Position badges */}
      {badges.length > 0 && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex gap-0.5 z-10">
          {badges.map((b, i) => (
            <span
              key={i}
              className={`${b.cls} text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-white/20`}
            >
              {b.label}
            </span>
          ))}
        </div>
      )}

      {/* Cards */}
      <div className={`flex justify-center mb-1 ${isFolded ? "grayscale" : ""}`}>
        {player.isRevealed && player.holeCards[0] !== null ? (
          <div className="relative">
            <CardHand cards={player.holeCards} size="sm" dealt />
            {/* FHE Verified badge on showdown reveal */}
            {isFinalStep && player.isRevealed && (
              <div
                className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider whitespace-nowrap z-10 replay-verified-badge"
                style={{
                  background: "linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)",
                  color: "white",
                  boxShadow: "0 0 8px rgba(34, 211, 238, 0.5)",
                }}
              >
                Ed25519 Verified
              </div>
            )}
          </div>
        ) : (
          /* Locked cards — privacy narrative */
          <div className="flex gap-1">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="w-10 h-[3.5rem] rounded-md relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, #1a365d 0%, #0d1b2a 100%)",
                  border: isFolded
                    ? "1px solid rgba(255,255,255,0.05)"
                    : "1px solid rgba(34, 211, 238, 0.3)",
                }}
              >
                {/* Lock icon */}
                {!isFolded && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg
                      className="w-3.5 h-3.5 text-cyan-400/60"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
                {/* Shimmer for encrypted cards */}
                {!isFolded && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: "linear-gradient(105deg, transparent 40%, rgba(34,211,238,0.06) 45%, rgba(34,211,238,0.12) 50%, rgba(34,211,238,0.06) 55%, transparent 60%)",
                      backgroundSize: "200% 100%",
                      animation: "card-shimmer 3s ease-in-out infinite",
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Player info */}
      <div className="text-center">
        <p className="text-[9px] text-[var(--text-muted)] truncate">{shortAddr}</p>
        <p className="text-xs font-bold text-gold-gradient font-display">
          {fmt(player.chips)}
        </p>
      </div>

      {/* Current bet */}
      {player.currentBet > 0 && (
        <div className="flex items-center justify-center gap-1 mt-0.5">
          <div
            className="w-3 h-3 rounded-full border-2 border-dashed border-white/30"
            style={{ background: "var(--chip-green)" }}
          />
          <span className="text-[10px] font-semibold text-[var(--text-primary)]">
            {fmt(player.currentBet)}
          </span>
        </div>
      )}

      {/* Status badges */}
      {player.status === "allin" && (
        <div className="text-center mt-0.5">
          <span
            className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full animate-pulse"
            style={{
              background: "linear-gradient(135deg, var(--chip-red) 0%, #8b0000 100%)",
              color: "white",
            }}
          >
            All In
          </span>
        </div>
      )}
      {isFolded && (
        <div className="text-center mt-0.5">
          <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Folded
          </span>
        </div>
      )}

      {/* Winner banner */}
      {isWinner && isFinalStep && (
        <div className="text-center mt-1">
          <span
            className="text-[9px] font-bold px-2 py-0.5 rounded-full"
            style={{
              background: "linear-gradient(135deg, rgba(212,160,18,0.3) 0%, rgba(212,160,18,0.1) 100%)",
              color: "var(--gold-light)",
              border: "1px solid rgba(212,160,18,0.4)",
            }}
          >
            +{fmt(player.chipsWon)} {token.symbol}
          </span>
          {player.handRank && (
            <p className="text-[8px] text-[var(--gold-light)] mt-0.5">{player.handRank}</p>
          )}
        </div>
      )}
    </div>
  );
};
