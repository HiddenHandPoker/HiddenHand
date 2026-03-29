"use client";

import { FC } from "react";
import Link from "next/link";

interface SelfExclusionBannerProps {
  timeLeft: string;
}

export const SelfExclusionBanner: FC<SelfExclusionBannerProps> = ({
  timeLeft,
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="glass rounded-2xl p-8 space-y-6">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto">
            <svg
              className="w-8 h-8 text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold text-[var(--text-primary)] mb-2">
              Self-Exclusion Active
            </h2>
            <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
              You&apos;ve chosen to take a break from playing. This exclusion
              cannot be reversed early.
            </p>
          </div>

          <div className="glass-dark rounded-xl px-6 py-4">
            <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-1">
              Time remaining
            </p>
            <p className="text-amber-400 font-display text-xl font-bold">
              {timeLeft}
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <p className="text-[var(--text-muted)] text-xs">
              If you&apos;re struggling with gambling, please reach out for help.
            </p>
            <div className="flex flex-col gap-2 text-xs">
              <a
                href="https://www.begambleaware.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--status-info)] hover:underline"
              >
                BeGambleAware.org
              </a>
              <a
                href="https://www.ncpgambling.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--status-info)] hover:underline"
              >
                National Council on Problem Gambling
              </a>
            </div>
          </div>

          <Link
            href="/responsible-gaming"
            className="inline-block text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors"
          >
            Learn more about responsible gaming
          </Link>
        </div>
      </div>
    </div>
  );
};
