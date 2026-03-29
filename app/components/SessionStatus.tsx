"use client";

import { FC, useState } from "react";
import type { SessionKeyState } from "@/hooks/useSessionKey";

interface SessionStatusProps {
  session: SessionKeyState;
  onCreateSession: () => Promise<void>;
  onRevokeSession: () => Promise<void>;
  loading: boolean;
  error: string | null;
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
  onCreateSession,
  onRevokeSession,
  loading,
  error,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  // No session — show create button
  if (!session.isActive) {
    return (
      <div className="glass-dark rounded-xl px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
          <span className="text-[var(--text-muted)] text-xs uppercase tracking-wider">
            No Session
          </span>
          <button
            onClick={onCreateSession}
            disabled={loading}
            className="ml-auto text-xs font-semibold px-3 py-1 rounded-lg
              bg-[var(--gold-main)] text-black hover:bg-[var(--gold-light)]
              disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? "Creating..." : "Enable Instant Play"}
          </button>
        </div>
        {error && (
          <p className="text-[var(--status-danger)] text-xs mt-1">{error}</p>
        )}
        <p className="text-[var(--text-muted)] text-[10px] mt-1 opacity-70">
          One wallet approval, then all actions are instant
        </p>
      </div>
    );
  }

  // Active session
  return (
    <div
      className={`glass-dark rounded-xl px-3 py-2 cursor-pointer transition-all ${
        session.isExpiring ? "border border-[var(--status-warning)]/30" : ""
      }`}
      onClick={() => setShowDetails(!showDetails)}
    >
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            session.isExpiring
              ? "bg-[var(--status-warning)] animate-pulse"
              : "bg-[var(--status-active)]"
          }`}
        />
        <span className="text-[var(--text-secondary)] text-xs uppercase tracking-wider">
          Instant Play
        </span>
        <span
          className={`text-xs font-mono font-bold ml-auto ${
            session.isExpiring
              ? "text-[var(--status-warning)]"
              : "text-[var(--text-secondary)]"
          }`}
        >
          {formatDuration(session.remainingSeconds)}
        </span>
      </div>

      {/* Expanded details */}
      {showDetails && (
        <div className="mt-2 pt-2 border-t border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)] text-[10px]">
              Actions signed instantly (no popups)
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCreateSession();
              }}
              disabled={loading}
              className="flex-1 text-xs font-semibold px-2 py-1.5 rounded-lg
                btn-action hover:border-[var(--gold-main)]
                disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? "..." : "Renew"}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRevokeSession();
              }}
              disabled={loading}
              className="flex-1 text-xs font-semibold px-2 py-1.5 rounded-lg
                btn-action hover:border-[var(--status-danger)]
                text-[var(--text-muted)] hover:text-[var(--status-danger)]
                disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              End Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
