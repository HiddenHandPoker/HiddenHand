"use client";

import { FC } from "react";
import { PROGRAM_ID } from "@/lib/program";
import { NETWORK } from "@/contexts/WalletProvider";

interface OnChainBadgeProps {
  compact?: boolean;
}

export const OnChainBadge: FC<OnChainBadgeProps> = ({ compact = false }) => {
  const explorerBase = NETWORK === "devnet"
    ? "https://explorer.solana.com/address/"
    : "https://explorer.solana.com/address/";
  const explorerSuffix = NETWORK === "devnet" ? "?cluster=devnet" : "";
  const programUrl = `${explorerBase}${PROGRAM_ID.toString()}${explorerSuffix}`;

  if (compact) {
    return (
      <a
        href={programUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-[10px] text-[var(--felt-highlight)] hover:text-[var(--felt-light)] transition-colors"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        On-Chain Verified
      </a>
    );
  }

  return (
    <div className="glass-dark rounded-xl p-4 border border-[var(--felt-main)]/30">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--felt-main)]/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-[var(--felt-highlight)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
            On-Chain Verified Statistics
          </h4>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-2">
            These stats aren&apos;t from our database. They&apos;re computed directly from Solana
            transactions that anyone can verify.
          </p>
          <a
            href={programUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--felt-highlight)] hover:text-[var(--felt-light)] transition-colors inline-flex items-center gap-1"
          >
            Audit on Solana Explorer
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
};
