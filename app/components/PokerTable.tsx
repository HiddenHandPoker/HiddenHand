"use client";

import { FC, useState, useEffect, useRef, useMemo } from "react";
import { PlayerSeat } from "./PlayerSeat";
import { Card } from "./Card";
import { ProvablyFairBadge } from "./ProvablyFairBadge";
import { ChipAnimationLayer } from "./ChipAnimation";
import { type TokenInfo, getDefaultToken, baseUnitsToDisplay } from "@/lib/tokens";
import { type PlayerStats } from "@/hooks/usePlayerStats";
import { useIsMobileLandscape } from "@/hooks/useIsMobile";
import { soundManager } from "@/lib/sounds";
import {
  ACTION_NAMES,
  formatLiveActionLine,
  type ActionTakenTimelineEvent,
} from "@/hooks/useHandHistory";

interface Player {
  seatIndex: number;
  player: string;
  chips: number;
  currentBet: number;
  holeCards: [number | null, number | null];
  revealedCards?: [number | null, number | null];
  cardsRevealed?: boolean;
  status: "empty" | "sitting" | "playing" | "folded" | "allin";
  handName?: string;
  isWinner?: boolean;
}

interface PokerTableProps {
  tableId: string;
  phase: string;
  pot: number;
  communityCards: number[];
  currentBet: number;
  dealerPosition: number;
  actionOn: number;
  players: Player[];
  currentPlayerAddress?: string;
  smallBlind: number;
  bigBlind: number;
  isShowdownPhase?: boolean;
  isDeckShuffled?: boolean; // MPC shuffle has completed
  isShuffling?: boolean;
  isDecrypting?: boolean;
  isRevealingCommunity?: boolean;
  isRevealing?: boolean;
  awaitingCommunityReveal?: boolean;
  // Chip animation triggers
  chipBetTrigger?: { seatIndex: number; amount: number; key: string } | null;
  chipWinTrigger?: { seatIndex: number; key: string } | null;
  // Token info for display
  token?: TokenInfo;
  // Player stats for HUD tooltips
  playerStatsMap?: Map<string, PlayerStats>;
  onEmptySeatClick?: (seatIndex: number) => void;
  /** Current-hand ActionTaken feed (websocket, not the 3s poll). */
  liveActions?: ActionTakenTimelineEvent[];
}

// Seat positions around the table (for 6-max)
// Positions are percentages from center
const SEAT_POSITIONS_DESKTOP = [
  { top: "88%", left: "50%", transform: "translate(-50%, -50%)" }, // Bottom center
  { top: "72%", left: "12%", transform: "translate(-50%, -50%)" }, // Bottom left
  { top: "28%", left: "12%", transform: "translate(-50%, -50%)" }, // Top left
  { top: "12%", left: "50%", transform: "translate(-50%, -50%)" }, // Top center
  { top: "28%", left: "88%", transform: "translate(-50%, -50%)" }, // Top right
  { top: "72%", left: "88%", transform: "translate(-50%, -50%)" }, // Bottom right
];

function slotsForHoldCount(
  holdCount: number | null,
  phase: string,
  revealing: boolean,
): number[] {
  if (holdCount === 3) return [0, 1, 2];
  if (holdCount === 4) return [3];
  if (holdCount === 5) return [4];
  if (!revealing) return [];
  if (phase === "PreFlop") return [0, 1, 2];
  if (phase === "Flop") return [3];
  if (phase === "Turn") return [4];
  return [];
}

const EMPTY_LIVE_ACTIONS: ActionTakenTimelineEvent[] = [];

function seatLastAction(event: ActionTakenTimelineEvent | undefined):
  | { type: string; amount?: number; at?: number; id?: string }
  | undefined {
  if (!event) return undefined;
  return {
    type: ACTION_NAMES[event.actionType] ?? "Act",
    amount: event.amount > 0 ? event.amount : undefined,
    at: event.timestamp.getTime(),
    id: event.signature ?? `${event.timestamp.getTime()}-${event.seatIndex}-${event.actionType}-${event.potAfter}`,
  };
}

function LiveActionLine({
  actions,
  formatAmount,
  compact,
}: {
  actions: ActionTakenTimelineEvent[];
  formatAmount: (baseUnits: number) => string;
  compact: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
  }, [actions.length]);

  if (actions.length === 0) {
    return <div className={compact ? "mt-0.5 h-4" : "mt-1.5 h-6"} />;
  }

  return (
    <div
      ref={scrollerRef}
      className={`mt-1 mx-auto ${compact ? "h-4 max-w-[70%] text-[9px]" : "sm:mt-2 h-6 max-w-[80%] text-sm"} overflow-x-auto scrollbar-hide whitespace-nowrap text-center`}
      aria-live="polite"
    >
      {actions.map((action, i) => {
        const key = `${action.signature ?? action.timestamp.getTime()}-${action.seatIndex}-${action.actionType}-${i}`;
        const isLatest = i === actions.length - 1;
        return (
          <span
            key={key}
            className={
              isLatest
                ? "live-action-line text-[var(--gold-light)] font-medium"
                : "text-[var(--text-muted)]"
            }
          >
            {i > 0 && <span className="text-[var(--text-muted)]"> · </span>}
            {formatLiveActionLine(action, formatAmount)}
          </span>
        );
      })}
    </div>
  );
}

// Tighter positions for mobile landscape — seats pulled closer to table edge
const SEAT_POSITIONS_MOBILE = [
  { top: "90%", left: "50%", transform: "translate(-50%, -50%)" }, // Bottom center (hero)
  { top: "72%", left: "6%", transform: "translate(-50%, -50%)" },  // Bottom left
  { top: "28%", left: "6%", transform: "translate(-50%, -50%)" },  // Top left
  { top: "10%", left: "50%", transform: "translate(-50%, -50%)" }, // Top center
  { top: "28%", left: "94%", transform: "translate(-50%, -50%)" }, // Top right
  { top: "72%", left: "94%", transform: "translate(-50%, -50%)" }, // Bottom right
];

export const PokerTable: FC<PokerTableProps> = ({
  tableId,
  phase,
  pot,
  communityCards,
  currentBet,
  dealerPosition,
  actionOn,
  players,
  currentPlayerAddress,
  smallBlind,
  bigBlind,
  isShowdownPhase = false,
  isDeckShuffled = false,
  isShuffling = false,
  isDecrypting = false,
  isRevealingCommunity = false,
  isRevealing = false,
  awaitingCommunityReveal = false,
  chipBetTrigger = null,
  chipWinTrigger = null,
  token = getDefaultToken(),
  playerStatsMap,
  onEmptySeatClick,
  liveActions = EMPTY_LIVE_ACTIONS,
}) => {
  const isMobile = useIsMobileLandscape();
  const SEAT_POSITIONS = isMobile ? SEAT_POSITIONS_MOBILE : SEAT_POSITIONS_DESKTOP;

  const fmt = (baseUnits: number) => baseUnitsToDisplay(baseUnits, token).toFixed(2);

  const lastActionBySeat = useMemo(() => {
    const map = new Map<number, ActionTakenTimelineEvent>();
    for (const action of liveActions) {
      map.set(action.seatIndex, action);
    }
    return map;
  }, [liveActions]);

  // Phase transition animation
  const [displayPhase, setDisplayPhase] = useState(phase);
  const [phaseAnimClass, setPhaseAnimClass] = useState("opacity-100");
  const prevPhaseRef = useRef(phase);

  useEffect(() => {
    if (phase !== prevPhaseRef.current) {
      // Fade out
      setPhaseAnimClass("opacity-0 scale-95");
      const t = setTimeout(() => {
        setDisplayPhase(phase);
        // Fade in
        setPhaseAnimClass("opacity-100 scale-100");
      }, 200);
      prevPhaseRef.current = phase;
      return () => clearTimeout(t);
    }
  }, [phase]);

  // Shuffle theater: keep the riffle going until the flag clears AND the deck is sealed.
  const shuffleTheater = isShuffling || (phase === "Dealing" && !isDeckShuffled);
  useEffect(() => {
    if (!isShuffling) return;
    soundManager.play("shuffle");
    const id = setInterval(() => soundManager.play("shuffle"), 3500);
    return () => clearInterval(id);
  }, [isShuffling]);

  // Calculate SB and BB positions
  const occupiedSeats = players
    .filter((p) => p.status !== "empty")
    .map((p) => p.seatIndex)
    .sort((a, b) => a - b);

  const getNextOccupied = (after: number) => {
    const idx = occupiedSeats.findIndex((s) => s > after);
    return idx >= 0 ? occupiedSeats[idx] : occupiedSeats[0];
  };

  const sbPosition = getNextOccupied(dealerPosition);
  const bbPosition = getNextOccupied(sbPosition);

  // Revealed community cards (255 = not yet written)
  const revealedCards = communityCards.filter((c) => c !== 255);

  // Hold board faces until the reveal flag clears AND the street's cards are in state.
  const revealHoldCountRef = useRef<number | null>(null);
  const communityRevealing = isRevealingCommunity || awaitingCommunityReveal;
  if (communityRevealing) {
    if (phase === "PreFlop") revealHoldCountRef.current = 3;
    else if (phase === "Flop") revealHoldCountRef.current = 4;
    else if (phase === "Turn") revealHoldCountRef.current = 5;
  }
  const holdCount = revealHoldCountRef.current;
  const pendingSlots = slotsForHoldCount(holdCount, phase, communityRevealing);
  const streetStillPending =
    pendingSlots.length > 0 &&
    (communityRevealing || pendingSlots.some((i) => revealedCards[i] === undefined));
  const activePendingSlots = streetStillPending ? pendingSlots : [];
  if (!communityRevealing && holdCount !== null && revealedCards.length >= holdCount) {
    revealHoldCountRef.current = null;
  }

  return (
    <div className="relative w-full max-w-5xl mx-auto">
    <div className="relative w-full aspect-[16/10] poker-table-container">
      {/* Ambient glow behind table */}
      <div
        className="absolute inset-0 rounded-[50%]"
        style={{
          background: "radial-gradient(ellipse at center, rgba(20, 90, 50, 0.4) 0%, transparent 60%)",
          filter: "blur(40px)",
        }}
      />

      {/* Outer rail (wood grain) */}
      <div
        className="absolute inset-2 sm:inset-4 rounded-[45%] shadow-2xl"
        style={{
          background: `
            linear-gradient(135deg, #3d2914 0%, #5c3d1e 20%, #7a4f24 40%, #5c3d1e 60%, #3d2914 80%, #2a1c0e 100%)
          `,
          boxShadow: `
            0 20px 60px rgba(0,0,0,0.6),
            0 0 0 4px rgba(0,0,0,0.3),
            inset 0 2px 4px rgba(255,255,255,0.1)
          `,
        }}
      >
        {/* Inner rail highlight */}
        <div
          className="absolute inset-1 rounded-[44%]"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 50%)",
          }}
        />

        {/* Gold trim */}
        <div
          className="absolute inset-3 rounded-[43%]"
          style={{
            border: "2px solid rgba(212, 160, 18, 0.3)",
            boxShadow: "inset 0 0 20px rgba(212, 160, 18, 0.1)",
          }}
        />
      </div>

      {/* Felt surface */}
      <div
        className={`absolute inset-5 sm:inset-10 rounded-[42%] overflow-hidden${shuffleTheater ? " mpc-shuffle-felt" : ""}`}
        style={{
          backgroundImage: "url('/hiddenhand-table-bg.webp')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          boxShadow: `
            inset 0 4px 20px rgba(0,0,0,0.4),
            inset 0 0 60px rgba(0,0,0,0.2)
          `,
        }}
      >
        {/* Felt inner border */}
        <div
          className="absolute inset-3 rounded-[40%]"
          style={{
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        />

        {/* Center spotlight effect */}
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse at center 40%, rgba(255,255,255,0.08) 0%, transparent 50%)",
          }}
        />

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {/* Pot display */}
          <div
            className={`glass rounded-2xl px-4 py-2 sm:px-8 sm:py-4 mb-3 sm:mb-6 relative ${pot > 0 ? 'animate-pulse-gold' : ''}`}
            style={{
              boxShadow: pot > 0
                ? '0 0 30px rgba(212, 160, 18, 0.3), inset 0 0 20px rgba(212, 160, 18, 0.1)'
                : undefined,
            }}
          >
            <div
              className="absolute inset-0 rounded-2xl"
              style={{
                background: "linear-gradient(135deg, rgba(212, 160, 18, 0.15) 0%, transparent 50%)",
              }}
            />
            <div className="relative flex items-center justify-center gap-1 sm:gap-2">
              <span className="text-[var(--text-muted)] text-[10px] sm:text-xs uppercase tracking-wider">
                Pot
              </span>
              <span className="text-gold-gradient font-display text-lg sm:text-3xl font-bold">
                {fmt(pot)}
              </span>
              <span className="text-[var(--gold-light)] text-sm sm:text-lg font-semibold">{token.symbol}</span>
            </div>
          </div>

          {/* Community cards area */}
          <div className="relative px-2 py-1.5 sm:px-4 sm:py-3">
            {/* Card area background */}
            <div
              className="absolute inset-0 rounded-xl"
              style={{
                background: "rgba(0,0,0,0.2)",
                boxShadow: "inset 0 2px 8px rgba(0,0,0,0.2)",
              }}
            />

            {/* Cards — shuffle riffle, then encrypted backs that only flip once MPC + state agree */}
            <div className="relative flex gap-1.5 sm:gap-3">
              {shuffleTheater ? (
                [0, 1, 2].map((i) => (
                  <div
                    key={`riffle-${i}`}
                    className="mpc-riffle-card"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <Card card={null} encrypted size={isMobile ? "xs" : "md"} />
                  </div>
                ))
              ) : (
                [0, 1, 2, 3, 4].map((idx) => {
                  const card = revealedCards[idx];
                  const isPending = activePendingSlots.includes(idx);
                  const showFace = card !== undefined && !isPending;
                  const isFlop = idx < 3;
                  const isTurn = idx === 3;
                  const isRiver = idx === 4;

                  return (
                    <div key={idx} className="relative">
                      {showFace || isPending ? (
                        <Card
                          card={showFace ? card : null}
                          encrypted={isPending}
                          size={isMobile ? "xs" : "md"}
                        />
                      ) : (
                        <div
                          className="w-9 h-[3.15rem] sm:w-16 sm:h-[5.6rem] rounded-lg border border-dashed flex items-center justify-center transition-all duration-300"
                          style={{
                            borderColor: "rgba(255,255,255,0.1)",
                            background: "rgba(0,0,0,0.1)",
                          }}
                        >
                          <span className="text-[var(--text-muted)] text-[8px] sm:text-xs opacity-50">
                            {isFlop ? (idx === 1 ? "FLOP" : "") : isTurn ? "TURN" : "RIVER"}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Phase indicator */}
          <div className="mt-2 sm:mt-5 flex items-center gap-2 sm:gap-3">
            <div
              className={`
                px-3 py-1 sm:px-5 sm:py-2 rounded-full uppercase tracking-widest text-[10px] sm:text-sm font-semibold
                transition-all duration-200 ease-in-out ${phaseAnimClass}
                ${displayPhase === "Showdown" || displayPhase === "Settled"
                  ? "bg-[var(--gold-main)] text-black"
                  : "glass text-[var(--gold-light)]"
                }
              `}
            >
              {displayPhase}
            </div>
            <ProvablyFairBadge
              isActive={shuffleTheater || isDeckShuffled || isRevealingCommunity || isRevealing}
              isShuffling={shuffleTheater}
            />
          </div>

          {/* Blinds info */}
          <div className="mt-1.5 sm:mt-3 glass-dark inline-flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-full text-[10px] sm:text-xs">
            <span className="uppercase tracking-wider text-[var(--text-secondary)]">Blinds</span>
            <span className="text-[var(--text-primary)] font-medium">
              ${fmt(smallBlind)} / ${fmt(bigBlind)}
            </span>
          </div>
        </div>
      </div>

      {/* Player seats */}
      {SEAT_POSITIONS.map((pos, idx) => {
        const player = players.find((p) => p.seatIndex === idx);
        const isCurrentPlayer = player?.player === currentPlayerAddress;

        return (
          <div
            key={idx}
            className="absolute w-[5.5rem] sm:w-36"
            style={pos}
          >
            <PlayerSeat
              seatIndex={idx}
              player={player?.player}
              chips={player?.chips ?? 0}
              currentBet={player?.currentBet ?? 0}
              holeCards={player?.holeCards ?? [null, null]}
              revealedCards={player?.revealedCards}
              cardsRevealed={player?.cardsRevealed}
              isActive={player?.status === "playing" || player?.status === "allin"}
              isDealer={idx === dealerPosition}
              isSmallBlind={idx === sbPosition}
              isBigBlind={idx === bbPosition}
              isTurn={idx === actionOn && phase !== "Showdown" && phase !== "Settled"}
              status={player?.status ?? "empty"}
              isCurrentPlayer={isCurrentPlayer}
              isShowdownPhase={isShowdownPhase}
              isRevealing={isRevealing}
              isDecrypting={isDecrypting && isCurrentPlayer}
              handName={player?.handName}
              isWinner={player?.isWinner}
              token={token}
              playerStats={player?.player && playerStatsMap ? playerStatsMap.get(player.player) : undefined}
              compact={isMobile}
              lastAction={
                player && player.status !== "empty"
                  ? seatLastAction(lastActionBySeat.get(idx))
                  : undefined
              }
              onSit={
                (!player || player.status === "empty") && onEmptySeatClick
                  ? () => onEmptySeatClick(idx)
                  : undefined
              }
            />
          </div>
        );
      })}

      {/* Chip animations - rendered inside table for correct positioning */}
      <ChipAnimationLayer
        betTrigger={chipBetTrigger}
        winTrigger={chipWinTrigger}
        bigBlind={bigBlind}
      />
    </div>
    <LiveActionLine actions={liveActions} formatAmount={fmt} compact={isMobile} />
    </div>
  );
};
