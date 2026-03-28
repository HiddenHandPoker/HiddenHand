"use client";

import { FC, useMemo } from "react";
import { PokerTable } from "./PokerTable";
import { useTableState, type SpectatorPlayer } from "@/hooks/useTableState";
import { getTokenByMint, getDefaultToken, baseUnitsToDisplay, type TokenInfo } from "@/lib/tokens";
import { PublicKey } from "@solana/web3.js";

/**
 * SpectatorView — Read-only view of an active poker table.
 *
 * Works WITHOUT a connected wallet. Uses useTableState for on-chain reads.
 *
 * PRIVACY INVARIANT: All player hole cards are [null, null]. Encrypted u128
 * handles from Inco FHE are NEVER passed to any component. Spectators see
 * card backs only. At showdown, only explicitly revealed cards are shown.
 */

interface SpectatorViewProps {
  tableId: string;
  /** Render "Connect Wallet" button — provided by parent which has wallet context */
  walletButton?: React.ReactNode;
  /** Whether the user has a connected wallet (for "Sit Down" vs "Connect to Play") */
  isConnected?: boolean;
  /** Called when user clicks "Sit Down" (only for connected users) */
  onSitDown?: () => void;
}

export const SpectatorView: FC<SpectatorViewProps> = ({
  tableId,
  walletButton,
  isConnected = false,
  onSitDown,
}) => {
  const { state, loading, error } = useTableState(tableId);

  // Resolve token for display
  const token: TokenInfo = useMemo(() => {
    if (state.tokenMint) {
      return getTokenByMint(state.tokenMint) ?? getDefaultToken();
    }
    return getDefaultToken();
  }, [state.tokenMint]);

  const fmt = (baseUnits: number) => baseUnitsToDisplay(baseUnits, token).toFixed(2);

  // Map players to PokerTable format — PRIVACY: all hole cards are [null, null]
  const playersForTable = useMemo(() => {
    return state.players.map((p: SpectatorPlayer) => ({
      seatIndex: p.seatIndex,
      player: p.player,
      chips: p.chips,
      currentBet: p.currentBet,
      holeCards: [null, null] as [null, null], // NEVER expose cards to spectators
      status: p.status,
      isEncrypted: p.isEncrypted,
      revealedCards: p.revealedCards, // Showdown reveals are public
      cardsRevealed: p.cardsRevealed,
    }));
  }, [state.players]);

  const isShowdownPhase = state.phase === "Showdown" || state.phase === "Settled";
  const hasPlayers = state.currentPlayers > 0;
  const hasOpenSeats = state.players.some((p) => p.status === "empty");

  return (
    <div className="space-y-6">
      {/* Spectator Banner */}
      <div
        className="glass rounded-2xl overflow-hidden"
        style={{
          borderImage: "linear-gradient(90deg, rgba(212,160,18,0.3), rgba(212,160,18,0.05)) 1",
          borderWidth: "1px",
          borderStyle: "solid",
        }}
      >
        <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            {/* Eye icon */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, rgba(212,160,18,0.2) 0%, rgba(212,160,18,0.05) 100%)",
                border: "1px solid rgba(212,160,18,0.3)",
              }}
            >
              <svg
                className="w-5 h-5 text-[var(--gold-light)]"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[var(--gold-light)] font-semibold text-sm">
                  Spectating
                </span>
                <span className="text-[var(--text-muted)] text-xs">
                  &mdash; Watch-only mode
                </span>
              </div>
              <p className="text-[var(--text-muted)] text-xs mt-0.5">
                Hole cards are FHE encrypted &mdash; only seated players can see their hands
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="flex items-center gap-3">
            {isConnected && hasOpenSeats ? (
              <button
                onClick={onSitDown}
                className="btn-gold px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Sit Down
              </button>
            ) : !isConnected ? (
              walletButton ?? (
                <span className="text-[var(--text-muted)] text-sm">
                  Connect wallet to join
                </span>
              )
            ) : null}
          </div>
        </div>
      </div>

      {/* Table Info Bar */}
      {state.tablePDA && (
        <div className="flex flex-wrap items-center gap-3">
          {/* Table name */}
          <div className="glass-dark px-4 py-2 rounded-xl text-sm flex items-center gap-2">
            <span className="text-[var(--text-muted)]">Table</span>
            <span className="text-[var(--text-primary)] font-medium">{tableId}</span>
          </div>

          {/* Status */}
          <div className="glass-dark px-4 py-2 rounded-xl text-sm flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  state.tableStatus === "Playing"
                    ? "bg-[var(--status-active)]"
                    : state.tableStatus === "Waiting"
                    ? "bg-[var(--status-warning)]"
                    : "bg-[var(--status-danger)]"
                }`}
              />
              <span className="text-[var(--text-secondary)]">{state.tableStatus}</span>
            </div>
            <span className="text-[var(--text-muted)]">
              {state.currentPlayers}/{state.maxPlayers} players
            </span>
          </div>

          {/* Stakes */}
          <div className="glass-dark px-4 py-2 rounded-xl text-sm flex items-center gap-2">
            <span className="text-[var(--text-muted)]">Blinds</span>
            <span className="text-[var(--text-primary)] font-medium">
              {fmt(state.smallBlind)} / {fmt(state.bigBlind)} {token.symbol}
            </span>
          </div>

          {/* Buy-in */}
          <div className="glass-dark px-4 py-2 rounded-xl text-sm flex items-center gap-2">
            <span className="text-[var(--text-muted)]">Buy-in</span>
            <span className="text-[var(--text-primary)] font-medium">
              {fmt(state.minBuyIn)} - {fmt(state.maxBuyIn)} {token.symbol}
            </span>
          </div>

          {/* Hand number */}
          {state.handNumber > 0 && (
            <div className="glass-dark px-4 py-2 rounded-xl text-sm flex items-center gap-2">
              <span className="text-[var(--text-muted)]">Hand</span>
              <span className="text-[var(--text-primary)] font-medium">#{state.handNumber}</span>
            </div>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && !state.tablePDA && (
        <div className="flex items-center justify-center py-20">
          <div className="glass rounded-2xl px-8 py-6 text-center">
            <div className="animate-spin h-8 w-8 border-3 border-[var(--gold-main)]/30 border-t-[var(--gold-main)] rounded-full mx-auto mb-4" />
            <p className="text-[var(--text-secondary)]">Loading table...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="glass rounded-xl p-4 border border-red-500/20 bg-red-500/5">
          <p className="text-red-400 text-sm">Failed to load table: {error}</p>
        </div>
      )}

      {/* Poker Table */}
      {state.tablePDA && (
        <PokerTable
          tableId={state.tableId}
          phase={state.phase}
          pot={state.pot}
          communityCards={
            state.communityCards.length > 0
              ? state.communityCards
              : [255, 255, 255, 255, 255]
          }
          currentBet={state.currentBet}
          dealerPosition={state.dealerPosition}
          actionOn={state.actionOn}
          players={playersForTable}
          currentPlayerAddress="" /* No current player for spectators */
          smallBlind={state.smallBlind}
          bigBlind={state.bigBlind}
          isShowdownPhase={isShowdownPhase}
          isVrfVerified={state.isDeckShuffled}
          token={token}
        />
      )}

      {/* Showdown Results for spectators */}
      {isShowdownPhase && state.players.some((p) => p.cardsRevealed) && (
        <div className="max-w-lg mx-auto glass border border-amber-500/30 rounded-2xl p-5 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <span className="text-amber-300 font-bold text-lg">Showdown</span>
          </div>
          <p className="text-[var(--text-secondary)] text-sm">
            Players are revealing their cards for hand evaluation
          </p>
        </div>
      )}

      {/* Privacy explainer for spectators */}
      {hasPlayers && state.tableStatus === "Playing" && (
        <div className="max-w-lg mx-auto">
          <div className="glass-dark rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h4 className="text-cyan-400 text-sm font-semibold mb-1">
                  Privacy-First Poker
                </h4>
                <p className="text-[var(--text-muted)] text-xs leading-relaxed">
                  Player hole cards are encrypted using Inco&apos;s Fully Homomorphic Encryption (FHE).
                  Cards are encrypted on-chain &mdash; not even the server can see them. Only each player
                  can decrypt their own hand. Card backs shown above represent truly encrypted data,
                  not hidden UI elements.
                </p>
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider">
                      MagicBlock VRF
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider">
                      Inco FHE
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider">
                      Solana
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No table found */}
      {!state.tablePDA && !loading && (
        <div className="text-center py-20">
          <div className="glass inline-block px-8 py-6 rounded-2xl mb-6">
            <p className="text-[var(--text-secondary)] text-lg">
              Table &quot;{tableId}&quot; not found.
            </p>
            <p className="text-[var(--text-muted)] text-sm mt-2">
              It may not have been created yet.
            </p>
          </div>
        </div>
      )}

      {/* Empty table */}
      {state.tablePDA && !hasPlayers && state.tableStatus === "Waiting" && (
        <div className="max-w-md mx-auto glass border border-[var(--gold-main)]/20 rounded-2xl p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--gold-main)]/10 border border-[var(--gold-main)]/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[var(--gold-light)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h3 className="text-[var(--text-primary)] font-semibold mb-2">
            Waiting for Players
          </h3>
          <p className="text-[var(--text-muted)] text-sm mb-4">
            This table is empty. Be the first to sit down!
          </p>
          {isConnected ? (
            <button
              onClick={onSitDown}
              className="btn-gold px-6 py-2.5 rounded-xl text-sm font-semibold"
            >
              Take a Seat
            </button>
          ) : (
            walletButton
          )}
        </div>
      )}
    </div>
  );
};
