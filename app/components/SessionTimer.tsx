"use client";

import { FC } from "react";

interface SessionTimerProps {
  formattedTime: string;
}

export const SessionTimer: FC<SessionTimerProps> = ({ formattedTime }) => {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-dark)] border border-white/5 text-xs">
      <svg
        className="w-3.5 h-3.5 text-[var(--text-muted)]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="text-[var(--text-muted)]">Session:</span>
      <span className="text-[var(--text-secondary)] font-medium font-mono">
        {formattedTime}
      </span>
    </div>
  );
};
