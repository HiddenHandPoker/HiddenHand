"use client";

import { FC, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { solToLamports } from "@/lib/utils";
import { getRakeForBlinds, formatRakeInfo } from "@/lib/rake";

interface CreateTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTable: (config: {
    tableId: string;
    smallBlind: number; // lamports
    bigBlind: number; // lamports
    minBuyIn: number; // lamports
    maxBuyIn: number; // lamports
    maxPlayers: number;
    rakeBps: number;
    rakeCap: number; // lamports
  }) => Promise<void>;
  loading?: boolean;
}

interface ValidationErrors {
  tableName?: string;
  blinds?: string;
  buyIn?: string;
  minBuyInFloor?: string;
}

export const CreateTableModal: FC<CreateTableModalProps> = ({
  isOpen,
  onClose,
  onCreateTable,
  loading = false,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Form state (SOL values)
  const [tableName, setTableName] = useState("");
  const [smallBlind, setSmallBlind] = useState(0.01);
  const [bigBlind, setBigBlind] = useState(0.02);
  const [minBuyIn, setMinBuyIn] = useState(0.5);
  const [maxBuyIn, setMaxBuyIn] = useState(5);
  const [maxPlayers, setMaxPlayers] = useState(6);

  // Auto-calculated rake based on blind level
  const rake = useMemo(
    () => getRakeForBlinds(solToLamports(bigBlind)),
    [bigBlind]
  );

  // Validation
  const [errors, setErrors] = useState<ValidationErrors>({});

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [isOpen]);

  // Validate on field changes
  const validate = useCallback((): ValidationErrors => {
    const errs: ValidationErrors = {};

    if (!tableName.trim()) {
      errs.tableName = "Table name is required";
    }
    if (bigBlind < smallBlind) {
      errs.blinds = "Big blind must be >= small blind";
    }
    if (minBuyIn > maxBuyIn) {
      errs.buyIn = "Min buy-in must be <= max buy-in";
    }
    if (minBuyIn < 10 * bigBlind) {
      errs.minBuyInFloor = `Min buy-in must be >= ${(10 * bigBlind).toFixed(
        4
      ).replace(/\.?0+$/, "")} SOL (10x big blind)`;
    }

    return errs;
  }, [tableName, smallBlind, bigBlind, minBuyIn, maxBuyIn]);

  const handleSubmit = async () => {
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    await onCreateTable({
      tableId: tableName.trim(),
      smallBlind: solToLamports(smallBlind),
      bigBlind: solToLamports(bigBlind),
      minBuyIn: solToLamports(minBuyIn),
      maxBuyIn: solToLamports(maxBuyIn),
      maxPlayers,
      rakeBps: rake.rakeBps,
      rakeCap: rake.rakeCap,
    });
  };

  if (!isOpen) return null;

  const inputClass =
    "w-full bg-[var(--bg-dark)] text-[var(--text-primary)] px-4 py-3 rounded-xl border border-white/5 focus:border-[var(--gold-main)] transition-colors";

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div
        ref={dialogRef}
        tabIndex={-1}
        className="glass rounded-3xl p-8 max-w-md w-full relative overflow-hidden max-h-[90vh] overflow-y-auto"
      >
        {/* Modal glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at top, rgba(212, 160, 18, 0.1) 0%, transparent 50%)",
          }}
        />

        <div className="relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">
              Create Table
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>

          <div className="space-y-5">
            {/* Table Name */}
            <div>
              <label className="block text-[var(--text-muted)] text-sm uppercase tracking-wider mb-2">
                Table Name
              </label>
              <input
                type="text"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="my-poker-table"
                className={inputClass}
              />
              {errors.tableName && (
                <p className="text-[var(--status-danger)] text-xs mt-1">
                  {errors.tableName}
                </p>
              )}
            </div>

            {/* Blinds */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[var(--text-muted)] text-sm uppercase tracking-wider mb-2">
                  Small Blind
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={smallBlind}
                    onChange={(e) => setSmallBlind(Number(e.target.value))}
                    step={0.001}
                    min={0.001}
                    className={inputClass}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">
                    SOL
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-[var(--text-muted)] text-sm uppercase tracking-wider mb-2">
                  Big Blind
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={bigBlind}
                    onChange={(e) => setBigBlind(Number(e.target.value))}
                    step={0.001}
                    min={0.001}
                    className={inputClass}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">
                    SOL
                  </span>
                </div>
              </div>
            </div>
            {errors.blinds && (
              <p className="text-[var(--status-danger)] text-xs -mt-3">
                {errors.blinds}
              </p>
            )}

            {/* Buy-in range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[var(--text-muted)] text-sm uppercase tracking-wider mb-2">
                  Min Buy-in
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={minBuyIn}
                    onChange={(e) => setMinBuyIn(Number(e.target.value))}
                    step={0.1}
                    min={0.1}
                    className={inputClass}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">
                    SOL
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-[var(--text-muted)] text-sm uppercase tracking-wider mb-2">
                  Max Buy-in
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={maxBuyIn}
                    onChange={(e) => setMaxBuyIn(Number(e.target.value))}
                    step={0.1}
                    min={0.1}
                    className={inputClass}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">
                    SOL
                  </span>
                </div>
              </div>
            </div>
            {errors.buyIn && (
              <p className="text-[var(--status-danger)] text-xs -mt-3">
                {errors.buyIn}
              </p>
            )}
            {errors.minBuyInFloor && (
              <p className="text-[var(--status-danger)] text-xs -mt-3">
                {errors.minBuyInFloor}
              </p>
            )}

            {/* Max Players */}
            <div>
              <label className="block text-[var(--text-muted)] text-sm uppercase tracking-wider mb-2">
                Max Players
              </label>
              <select
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className={inputClass}
              >
                <option value={2}>2 Players (Heads-up)</option>
                <option value={3}>3 Players</option>
                <option value={4}>4 Players</option>
                <option value={5}>5 Players</option>
                <option value={6}>6 Players (6-max)</option>
              </select>
            </div>

            {/* Rake Info (auto-calculated) */}
            <div className="bg-[var(--bg-dark)] rounded-xl border border-white/5 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)] text-sm uppercase tracking-wider">
                  Platform Rake
                </span>
                <span className="text-[var(--gold-light)] font-semibold text-sm">
                  {formatRakeInfo(rake.rakeBps, rake.rakeCap)}
                </span>
              </div>
              <p className="text-[var(--text-muted)] text-xs mt-2">
                Rake is set automatically based on stake level.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-4 mt-8">
            <button
              onClick={onClose}
              className="flex-1 btn-action py-3 rounded-xl font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !tableName.trim()}
              className="flex-1 btn-gold py-3 rounded-xl font-semibold disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Table"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
