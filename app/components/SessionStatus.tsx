"use client";

import { FC } from "react";
import type { SessionKeyState } from "@/hooks/useSessionKey";

interface SessionStatusProps {
  session: SessionKeyState;
  onRenewSession: () => Promise<void>;
  loading: boolean;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const SessionStatus: FC<SessionStatusProps> = ({
  session,
  onRenewSession,
  loading,
}) => {
  // No session — nothing to show (session is auto-created on join)
  if (!session.isActive) return null;

  // Session expiring — show renew prompt
  if (session.isExpiring) {
    return (
      <div className="glass-dark rounded-xl px-3 py-2 border border-[var(--status-warning)]/30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--status-warning)] animate-pulse" />
          <span className="text-[var(--status-warning)] text-xs font-medium">
            Session expiring in {formatDuration(session.remainingSeconds)}
          </span>
          <button
            onClick={onRenewSession}
            disabled={loading}
            className="ml-auto text-xs font-semibold px-3 py-1 rounded-lg
              bg-[var(--gold-main)] text-black hover:bg-[var(--gold-light)]
              disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? "..." : "Renew"}
          </button>
        </div>
      </div>
    );
  }

  // Active session — minimal passive indicator
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 opacity-60">
      <div className="w-1.5 h-1.5 rounded-full bg-[var(--status-active)]" />
      <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider">
        Instant Play
      </span>
      <span className="text-[var(--text-muted)] text-[10px] font-mono">
        {formatDuration(session.remainingSeconds)}
      </span>
    </div>
  );
};
