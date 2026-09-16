"use client";

import { FC } from "react";
import { PublicKey } from "@solana/web3.js";
import { formatCard } from "@/lib/utils";

export const DECK_EXPLORER = (deckPda: PublicKey) =>
  `https://explorer.solana.com/address/${deckPda.toBase58()}?cluster=devnet`;

/** First 8 bytes of MXE-sealed `deck[0]` as hex + ellipsis. Never dump 64 bytes. */
export function formatDeckCipherPrefix(deck: unknown): string | null {
  if (!Array.isArray(deck) || deck.length === 0) return null;
  const field0 = deck[0];
  let bytes: number[];
  if (field0 instanceof Uint8Array) {
    bytes = Array.from(field0);
  } else if (Array.isArray(field0)) {
    bytes = field0.map((b) => (typeof b === "number" ? b : Number(b)));
  } else {
    return null;
  }
  if (bytes.length < 8 || bytes.some((b) => !Number.isFinite(b))) return null;
  const hex = bytes
    .slice(0, 8)
    .map((b) => (b & 0xff).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `0x${hex}…`;
}

export interface HouseSeesInfo {
  cipherPrefix: string | null;
  explorerUrl: string | null;
  youSee: [number | null, number | null];
  /** Hero hole cards once showdown has published them; otherwise table sees backs. */
  tableSees: [number | null, number | null] | null;
}

function isFacePair(cards: [number | null, number | null] | null): cards is [number, number] {
  if (!cards) return false;
  const [a, b] = cards;
  return a !== null && b !== null && a >= 0 && a <= 51 && b >= 0 && b <= 51;
}

const CARD_BACKS = "🂠 🂠";

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
  houseSees?: HouseSeesInfo | null;
}

export const GameStatusBar: FC<GameStatusBarProps> = ({
  phase,
  potLabel,
  toCallLabel,
  actionLabel,
  mpcLabel,
  houseSees,
}) => (
  <div className="max-w-3xl mx-auto space-y-1">
    <div
      className="glass rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
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
    {houseSees && <HouseSeesStrip {...houseSees} />}
  </div>
);

export const HouseSeesStrip: FC<HouseSeesInfo> = ({
  cipherPrefix,
  explorerUrl,
  youSee,
  tableSees,
}) => {
  const youFaces = isFacePair(youSee);
  const tableFaces = isFacePair(tableSees);

  return (
    <div
      className="glass rounded-xl h-10 px-3 sm:px-4 flex items-center gap-x-3 sm:gap-x-4 text-[10px] sm:text-xs overflow-x-auto scrollbar-hide whitespace-nowrap"
      role="status"
      aria-label="Privacy view: house ciphertext, your hole cards, table view"
    >
      <span className="flex items-center gap-1.5 min-w-0">
        <span className="text-[var(--text-muted)]">House sees:</span>
        <span className="text-cyan-400 font-mono">
          deck ciphertext {cipherPrefix ?? "—"}
        </span>
        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400/80 hover:text-cyan-300 underline-offset-2 hover:underline"
          >
            [Explorer]
          </a>
        )}
      </span>
      <span className="text-[var(--text-muted)]">·</span>
      <span className="flex items-center gap-1.5">
        <span className="text-[var(--text-muted)]">You see:</span>
        {youFaces ? (
          <span className="text-[var(--text-primary)] font-medium">
            {formatCard(youSee[0])} {formatCard(youSee[1])}
          </span>
        ) : (
          <span className="text-[var(--text-muted)]"> </span>
        )}
      </span>
      <span className="text-[var(--text-muted)]">·</span>
      <span className="flex items-center gap-1.5">
        <span className="text-[var(--text-muted)]">Table sees:</span>
        {tableFaces ? (
          <span className="text-[var(--text-primary)] font-medium">
            {formatCard(tableSees[0])} {formatCard(tableSees[1])}
          </span>
        ) : (
          <span className="text-[var(--text-secondary)] tracking-widest">{CARD_BACKS}</span>
        )}
      </span>
    </div>
  );
};
