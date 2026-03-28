"use client";

import { FC, useState, useMemo, useEffect } from "react";
import { type LobbyTable } from "@/hooks/useLobby";
import { getDefaultToken, baseUnitsToDisplay, type TokenInfo } from "@/lib/tokens";

interface QuickPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  tables: LobbyTable[];
  onJoinTable: (table: LobbyTable, buyIn: number) => void;
  onCreateAndJoin: (config: {
    smallBlind: number;
    bigBlind: number;
    minBuyIn: number;
    maxBuyIn: number;
    maxPlayers: number;
    buyIn: number;
  }) => void;
  loading?: boolean;
}

interface StakePreset {
  label: string;
  sb: number; // in base units
  bb: number; // in base units
  minBuyIn: number;
  maxBuyIn: number;
}

function getStakePresets(token: TokenInfo): StakePreset[] {
  const u = token.baseUnitsPerToken;
  return [
    { label: "Micro",  sb: Math.round(0.005 * u), bb: Math.round(0.01 * u),  minBuyIn: Math.round(0.2 * u),  maxBuyIn: Math.round(1 * u) },
    { label: "Low",    sb: Math.round(0.01 * u),  bb: Math.round(0.02 * u),  minBuyIn: Math.round(0.4 * u),  maxBuyIn: Math.round(2 * u) },
    { label: "Medium", sb: Math.round(0.05 * u),  bb: Math.round(0.10 * u),  minBuyIn: Math.round(2 * u),    maxBuyIn: Math.round(10 * u) },
    { label: "High",   sb: Math.round(0.50 * u),  bb: Math.round(1.00 * u),  minBuyIn: Math.round(20 * u),   maxBuyIn: Math.round(100 * u) },
  ];
}

export const QuickPlayModal: FC<QuickPlayModalProps> = ({
  isOpen,
  onClose,
  tables,
  onJoinTable,
  onCreateAndJoin,
  loading = false,
}) => {
  const token = getDefaultToken();
  const presets = useMemo(() => getStakePresets(token), [token]);
  const fmt = (v: number) => baseUnitsToDisplay(v, token).toFixed(2);

  const [selectedPreset, setSelectedPreset] = useState(1); // Default to "Low"
  const [buyIn, setBuyIn] = useState(0);
  const [status, setStatus] = useState<"idle" | "searching" | "creating">("idle");

  const preset = presets[selectedPreset];

  // Update buy-in when preset changes (default to 50 BB)
  useEffect(() => {
    const defaultBuyIn = preset.bb * 50;
    const clamped = Math.min(Math.max(defaultBuyIn, preset.minBuyIn), preset.maxBuyIn);
    setBuyIn(clamped);
  }, [selectedPreset, preset]);

  // Find matching tables
  const matchingTables = useMemo(() => {
    return tables.filter((t) => {
      const matchesStakes = t.bigBlind === preset.bb;
      const hasOpenSeat = t.currentPlayers < t.maxPlayers;
      const isOpen = t.status !== "Closed";
      return matchesStakes && hasOpenSeat && isOpen;
    });
  }, [tables, preset.bb]);

  const handleQuickPlay = () => {
    if (matchingTables.length > 0) {
      // Join the table with most players (more action)
      setStatus("searching");
      const best = [...matchingTables].sort(
        (a, b) => b.currentPlayers - a.currentPlayers,
      )[0];
      onJoinTable(best, buyIn);
    } else {
      // No matching tables — create one
      setStatus("creating");
      onCreateAndJoin({
        smallBlind: preset.sb,
        bigBlind: preset.bb,
        minBuyIn: preset.minBuyIn,
        maxBuyIn: preset.maxBuyIn,
        maxPlayers: 6,
        buyIn,
      });
    }
  };

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative glass rounded-2xl w-full max-w-md overflow-hidden"
        style={{
          boxShadow: "0 0 60px rgba(212, 160, 18, 0.1), 0 25px 50px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, rgba(212,160,18,0.2) 0%, rgba(212,160,18,0.05) 100%)",
                border: "1px solid rgba(212,160,18,0.3)",
              }}
            >
              <svg className="w-5 h-5 text-[var(--gold-light)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">Quick Play</h3>
              <p className="text-[var(--text-muted)] text-xs">Find a seat instantly</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stake selection */}
        <div className="px-6 pb-4">
          <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">
            Stakes
          </label>
          <div className="grid grid-cols-4 gap-2">
            {presets.map((p, idx) => (
              <button
                key={p.label}
                onClick={() => setSelectedPreset(idx)}
                className={`
                  p-3 rounded-xl text-center transition-all border
                  ${
                    selectedPreset === idx
                      ? "bg-[var(--gold-main)]/15 border-[var(--gold-main)]/50 shadow-[0_0_12px_rgba(212,160,18,0.15)]"
                      : "bg-[var(--bg-dark)] border-white/5 hover:border-white/10"
                  }
                `}
              >
                <span className="block text-sm font-semibold text-[var(--text-primary)]">
                  {fmt(p.bb)}
                </span>
                <span className="block text-[10px] text-[var(--text-muted)] mt-0.5">
                  {p.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Buy-in slider */}
        <div className="px-6 pb-4">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
              Buy-in
            </label>
            <span className="text-sm font-semibold text-[var(--gold-light)]">
              {fmt(buyIn)} {token.symbol}
            </span>
          </div>
          <input
            type="range"
            min={preset.minBuyIn}
            max={preset.maxBuyIn}
            step={preset.bb}
            value={buyIn}
            onChange={(e) => setBuyIn(Number(e.target.value))}
            className="w-full accent-[var(--gold-main)] h-2 rounded-full bg-[var(--bg-dark)] cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1">
            <span>{fmt(preset.minBuyIn)} (20 BB)</span>
            <span>{fmt(preset.maxBuyIn)} (100 BB)</span>
          </div>
        </div>

        {/* Matching tables info */}
        <div className="px-6 pb-4">
          <div className="glass-dark rounded-xl px-4 py-3 flex items-center gap-3">
            {matchingTables.length > 0 ? (
              <>
                <div className="w-2 h-2 rounded-full bg-[var(--status-active)]" />
                <span className="text-sm text-[var(--text-secondary)]">
                  <span className="text-[var(--text-primary)] font-semibold">
                    {matchingTables.length}
                  </span>{" "}
                  {matchingTables.length === 1 ? "table" : "tables"} available
                </span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-[var(--status-warning)]" />
                <span className="text-sm text-[var(--text-secondary)]">
                  No tables at this level &mdash; one will be created for you
                </span>
              </>
            )}
          </div>
        </div>

        {/* Action button */}
        <div className="px-6 pb-6">
          <button
            onClick={handleQuickPlay}
            disabled={loading || status !== "idle"}
            className="btn-gold w-full py-3.5 rounded-xl font-bold text-base disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {status === "searching" ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-black/30 border-t-black rounded-full" />
                Joining...
              </>
            ) : status === "creating" ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-black/30 border-t-black rounded-full" />
                Creating table...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Find Me a Seat
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
