"use client";

import { FC } from "react";

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
