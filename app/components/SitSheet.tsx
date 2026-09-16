"use client";

import { FC, useEffect, useRef } from "react";
import { FaucetButton } from "./FaucetButton";
import {
  type TokenInfo,
  baseUnitsToDisplay,
  displayToBaseUnits,
  FAUCET_TOKEN,
} from "@/lib/tokens";

interface SitSheetProps {
  isOpen: boolean;
  seatIndex: number;
  buyIn: number;
  minBuyIn: number;
  maxBuyIn: number;
  token: TokenInfo;
  balance: number | null;
  loading?: boolean;
  compact?: boolean;
  depositLimitMsg?: string | null;
  onBuyInChange: (value: number) => void;
  onSit: () => void;
  onClose: () => void;
  onGetToken?: () => void;
  onDismissLimit?: () => void;
  onFaucetSuccess?: () => void;
}

export const SitSheet: FC<SitSheetProps> = ({
  isOpen,
  seatIndex,
  buyIn,
  minBuyIn,
  maxBuyIn,
  token,
  balance,
  loading = false,
  compact = false,
  depositLimitMsg = null,
  onBuyInChange,
  onSit,
  onClose,
  onGetToken,
  onDismissLimit,
  onFaucetSuccess,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const buyInBase = displayToBaseUnits(buyIn, token);
  const outOfRange = buyIn < minBuyIn || buyIn > maxBuyIn;
  const insufficient = balance !== null && balance < buyInBase;
  const isFaucetToken = token.mint.equals(FAUCET_TOKEN.mint);
  const canSit = !loading && !outOfRange && balance !== null && !insufficient && !depositLimitMsg;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && dialogRef.current) dialogRef.current.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[60] flex ${compact ? "items-end" : "items-end sm:items-center"} justify-center p-0 sm:p-4`}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sit-sheet-title"
        className={`relative glass rounded-t-2xl sm:rounded-2xl w-full max-w-md safe-bottom ${
          compact ? "max-h-[70vh] overflow-y-auto" : "overflow-hidden"
        }`}
        style={{
          boxShadow: "0 0 60px rgba(212, 160, 18, 0.1), 0 25px 50px rgba(0,0,0,0.5)",
        }}
      >
        <div className={`flex items-center justify-between ${compact ? "px-4 pt-3 pb-2" : "px-6 pt-6 pb-4"}`}>
          <div>
            <h3
              id="sit-sheet-title"
              className={`font-display font-bold text-[var(--text-primary)] ${compact ? "text-base" : "text-lg"}`}
            >
              Sit · Seat {seatIndex + 1}
            </h3>
            <p className="text-[var(--text-muted)] text-xs">
              Stack {minBuyIn.toFixed(2)}–{maxBuyIn.toFixed(2)} {token.symbol}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors touch-target"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={`space-y-3 ${compact ? "px-4 pb-3" : "px-6 pb-6"}`}>
          <label className="block text-[var(--text-muted)] text-xs uppercase tracking-wider">
            Stack
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={buyIn}
              onChange={(e) => onBuyInChange(Number(e.target.value))}
              min={minBuyIn}
              max={maxBuyIn}
              step={0.01}
              className="flex-1 bg-[var(--bg-dark)] text-[var(--text-primary)] px-4 py-2.5 rounded-xl text-sm border border-white/5"
            />
            <span className="text-[var(--text-muted)] text-sm">{token.symbol}</span>
          </div>
          {outOfRange && (
            <p className="text-[var(--status-warning)] text-xs">
              Buy-in must be {minBuyIn.toFixed(2)}–{maxBuyIn.toFixed(2)} {token.symbol}
            </p>
          )}
          {balance !== null && (
            <p className={`text-xs ${insufficient ? "text-[var(--status-warning)]" : "text-[var(--text-muted)]"}`}>
              Balance: {baseUnitsToDisplay(balance, token).toFixed(2)} {token.symbol}
              {insufficient ? ` (need ${buyIn.toFixed(2)})` : ""}
            </p>
          )}

          {insufficient && isFaucetToken && (
            <FaucetButton onSuccess={onFaucetSuccess} />
          )}
          {insufficient && !isFaucetToken && onGetToken && (
            <button
              type="button"
              onClick={onGetToken}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 bg-[#2775CA]/20 border border-[#2775CA]/40 text-[#5B9BD5] hover:bg-[#2775CA]/30 transition-colors"
            >
              Get {token.symbol}
            </button>
          )}

          {depositLimitMsg && (
            <div className="glass-dark border border-amber-500/30 rounded-xl px-4 py-2 flex items-start gap-2">
              <span className="text-amber-300 text-xs">{depositLimitMsg}</span>
              {onDismissLimit && (
                <button
                  type="button"
                  onClick={onDismissLimit}
                  className="text-amber-400/60 hover:text-amber-300 ml-auto flex-shrink-0"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wide btn-action transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSit}
              disabled={!canSit}
              className="flex-1 btn-gold py-3 rounded-xl font-bold uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed transition-all touch-target"
            >
              Sit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
