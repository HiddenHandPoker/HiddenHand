"use client";

import { FC } from "react";

export interface MpcStatusInput {
  phase: string;
  isShuffling: boolean;
  isDecrypting: boolean;
  isRevealingCommunity: boolean;
  isRevealing: boolean;
  awaitingCommunityReveal: boolean;
  isDeckShuffled: boolean;
  dealtPlayers: number;
  activePlayers: number;
  allRemainingRevealed: boolean;
  pot: number;
}

function firstUndealtSeat(activePlayers: number, dealtPlayers: number): number | null {
  for (let s = 0; s < 8; s++) {
    if ((activePlayers & (1 << s)) !== 0 && (dealtPlayers & (1 << s)) === 0) {
      return s;
    }
  }
  return null;
}

/** Circuit-named MPC copy. Never "host" / "waiting for authority". */
export function mpcStatusLabel(s: MpcStatusInput): string | null {
  if (s.isShuffling || (s.phase === "Dealing" && !s.isDeckShuffled)) {
    return "Shuffling 52 cards in Arcium MPC…";
  }
  if (s.isDecrypting) {
    return "Sealing your hole cards…";
  }
  if (s.phase === "Dealing" && s.isDeckShuffled) {
    const pending = firstUndealtSeat(s.activePlayers, s.dealtPlayers);
    if (pending !== null) {
      return `Waiting for Seat ${pending + 1} to deal in`;
    }
  }
  if (s.isRevealingCommunity || s.awaitingCommunityReveal) {
    if (s.phase === "Flop") return "Revealing the turn from the sealed deck…";
    if (s.phase === "Turn") return "Revealing the river from the sealed deck…";
    return "Revealing the flop from the sealed deck…";
  }
  if (s.isRevealing || (s.phase === "Showdown" && !s.allRemainingRevealed)) {
    return "Publishing remaining hands from the sealed deck…";
  }
  if (
    (s.phase === "Showdown" && s.allRemainingRevealed) ||
    (s.phase === "Settled" && s.pot > 0)
  ) {
    return "Settling the pot…";
  }
  return null;
}

interface GameStatusBarProps {
  phase: string;
  potLabel: string;
  toCallLabel: string | null;
  actionLabel: string;
  mpcLabel: string | null;
}

export const GameStatusBar: FC<GameStatusBarProps> = ({
  phase,
  potLabel,
  toCallLabel,
  actionLabel,
  mpcLabel,
}) => (
  <div
    className="max-w-3xl mx-auto glass rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
    role="status"
    aria-live="polite"
  >
    <span className="text-[var(--gold-light)] font-semibold uppercase tracking-wider">
      {phase}
    </span>
    <span className="text-[var(--text-muted)]">·</span>
    <span className="text-[var(--text-secondary)]">
      Pot <span className="text-[var(--text-primary)] font-medium">{potLabel}</span>
    </span>
    {toCallLabel && (
      <>
        <span className="text-[var(--text-muted)]">·</span>
        <span className="text-[var(--text-secondary)]">
          To call <span className="text-[var(--text-primary)] font-medium">{toCallLabel}</span>
        </span>
      </>
    )}
    <span className="text-[var(--text-muted)]">·</span>
    <span className="text-[var(--text-secondary)]">{actionLabel}</span>
    {mpcLabel && (
      <span className="ml-auto text-cyan-400 text-xs font-medium flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        {mpcLabel}
      </span>
    )}
  </div>
);
