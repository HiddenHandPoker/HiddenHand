"use client";

import React, { useState } from "react";
import {
  HandHistoryEntry,
  TimelineEvent,
  formatCard,
  getSuitColor,
  PHASE_NAMES,
  ACTION_NAMES,
} from "@/hooks/useHandHistory";
import { getDefaultToken, baseUnitsToDisplay, TokenInfo } from "@/lib/tokens";
import { SECONDS_PER_MINUTE, SECONDS_PER_HOUR, SECONDS_PER_DAY } from "@/lib/constants";
import { NETWORK } from "@/contexts/WalletProvider";
import { Tooltip, InfoIcon } from "@/components/Tooltip";
import { HandReplayer } from "@/components/HandReplayer";

interface OnChainHandHistoryProps {
  history: HandHistoryEntry[];
  handTimelines: Map<number, TimelineEvent[]>;
  currentPlayerPubkey?: string;
  isListening: boolean;
  loadingHistory?: boolean;
}

export function OnChainHandHistory({
  history,
  handTimelines,
  currentPlayerPubkey,
  isListening,
  loadingHistory = false,
}: OnChainHandHistoryProps) {
  const [expandedHands, setExpandedHands] = useState<Set<number>>(new Set());
  const [replayHandNumber, setReplayHandNumber] = useState<number | null>(null);
  const token = getDefaultToken();

  const explorerUrl = NETWORK === "devnet"
    ? "https://explorer.solana.com/tx/"
    : "https://explorer.solana.com/tx/";

  const explorerSuffix = NETWORK === "devnet" ? "?cluster=devnet" : "";

  const toggleTimeline = (handNumber: number) => {
    setExpandedHands(prev => {
      const next = new Set(prev);
      if (next.has(handNumber)) {
        next.delete(handNumber);
      } else {
        next.add(handNumber);
      }
      return next;
    });
  };

  if (history.length === 0) {
    return (
      <div className="glass-dark rounded-xl p-4">
        <HeaderBar isListening={isListening} loadingHistory={loadingHistory} />
        {loadingHistory ? (
          <div className="flex items-center gap-3 py-2">
            <div className="animate-spin w-4 h-4 border-2 border-[var(--gold-main)] border-t-transparent rounded-full flex-shrink-0" />
            <p className="text-sm text-[var(--text-secondary)]">
              Loading hand history from chain...
            </p>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">
            No hands recorded yet. Hand history will appear here after showdowns.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="glass-dark rounded-xl p-4">
      <HeaderBar isListening={isListening} loadingHistory={loadingHistory} />

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {history.map((hand, idx) => {
          const timeline = handTimelines.get(hand.handNumber) || [];
          const isExpanded = expandedHands.has(hand.handNumber);
          const hasTimeline = timeline.length > 0;

          return (
            <div
              key={`${hand.handNumber}-${idx}`}
              className="bg-black/20 rounded-lg p-3 border border-white/5"
            >
              {/* Header — clickable when timeline exists */}
              <div
                className={`flex items-center justify-between mb-2 ${hasTimeline ? "cursor-pointer select-none" : ""}`}
                onClick={hasTimeline ? () => toggleTimeline(hand.handNumber) : undefined}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    Hand #{hand.handNumber}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {hand.players.length} players
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-secondary)]">
                    {formatTimeAgo(hand.timestamp)}
                  </span>
                  {hasTimeline && (
                    <span className={`text-xs text-[var(--text-muted)] transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}>
                      {"\u25B8"}
                    </span>
                  )}
                </div>
              </div>

              {/* Pot */}
              <div className="text-xs text-[var(--text-secondary)] mb-2">
                Pot: <span className="text-[var(--gold)]">{baseUnitsToDisplay(hand.totalPot, token).toFixed(2)} {token.symbol}</span>
              </div>

              {/* Timeline (expanded) */}
              <div
                className={`overflow-hidden transition-all duration-200 ${isExpanded && hasTimeline ? "max-h-[800px] opacity-100 mb-2" : "max-h-0 opacity-0"}`}
              >
                <div className="pl-1 space-y-0.5 pt-1">
                  {timeline.map((event, i) => (
                    <TimelineEventRow key={i} event={event} token={token} />
                  ))}
                  {/* Winner summary with actual winnings */}
                  {(() => {
                    const winners = hand.players.filter(p => p.chipsWon > 0);
                    if (winners.length === 0) return null;
                    return (
                      <div className="flex items-center gap-2 pl-1 py-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--status-active)] flex-shrink-0" />
                        <span className="text-xs text-green-400">
                          {winners.map((p, i) => (
                            <span key={p.seatIndex}>
                              {i > 0 && ", "}
                              Seat {p.seatIndex + 1} wins {baseUnitsToDisplay(p.chipsWon, token).toFixed(2)} {token.symbol}
                            </span>
                          ))}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Community Cards */}
              <div className="mb-2">
                <span className="text-xs text-[var(--text-secondary)]">Board: </span>
                <span className="font-mono text-base font-semibold">
                  {hand.communityCards.length > 0 ? (
                    hand.communityCards.map((card, i) => (
                      <span key={i} className={`mx-0.5 ${getSuitColor(card)}`}>
                        {formatCard(card)}
                      </span>
                    ))
                  ) : (
                    <span className="text-[var(--text-secondary)] text-xs font-normal">No cards</span>
                  )}
                </span>
              </div>

              {/* Player Results */}
              <div className="space-y-1">
                {hand.players.map((player, pIdx) => {
                  const isCurrentPlayer = player.player === currentPlayerPubkey;

                  return (
                    <div
                      key={pIdx}
                      className={`text-xs flex items-center gap-2 ${isCurrentPlayer ? "text-[var(--gold)]" : "text-[var(--text-secondary)]"}`}
                    >
                      <span className="w-14">
                        Seat {player.seatIndex + 1}
                        {isCurrentPlayer && " (you)"}
                      </span>

                      {player.folded ? (
                        <span className="text-gray-500 italic">folded</span>
                      ) : player.holeCards ? (
                        <span className="font-mono text-base font-semibold">
                          <span className={getSuitColor(player.holeCards[0])}>
                            {formatCard(player.holeCards[0])}
                          </span>
                          {" "}
                          <span className={getSuitColor(player.holeCards[1])}>
                            {formatCard(player.holeCards[1])}
                          </span>
                        </span>
                      ) : (
                        <span className="text-gray-500">hidden</span>
                      )}

                      {player.handRank && (
                        <span className="text-[var(--text-primary)]">
                          - {player.handRank}
                        </span>
                      )}

                      {player.allIn && (
                        <span className="text-orange-400 text-[10px]">ALL-IN</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Replay + Explorer Link */}
              <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                {/* Replay button */}
                {hasTimeline && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setReplayHandNumber(hand.handNumber);
                    }}
                    className="text-xs text-[var(--gold-light)] hover:text-[var(--gold-main)] flex items-center gap-1 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                    Replay
                  </button>
                )}

                {/* Explorer link */}
                {hand.signature && (
                  <a
                    href={`${explorerUrl}${hand.signature}${explorerSuffix}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    View on Explorer
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Hand Replayer Modal */}
      {replayHandNumber !== null && (() => {
        const replayHand = history.find((h) => h.handNumber === replayHandNumber);
        const replayTimeline = handTimelines.get(replayHandNumber) || [];
        if (!replayHand || replayTimeline.length === 0) return null;
        return (
          <HandReplayer
            hand={replayHand}
            timeline={replayTimeline}
            token={token}
            onClose={() => setReplayHandNumber(null)}
          />
        );
      })()}
    </div>
  );
}

// --- Sub-components ---

function HeaderBar({ isListening, loadingHistory }: { isListening: boolean; loadingHistory: boolean }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <Tooltip
        title="Blockchain Audit Trail"
        content="Every hand is permanently recorded on Solana with a full action-by-action timeline. Click any hand to expand the action log."
      >
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center cursor-help">
          On-Chain Hand History
          <InfoIcon />
        </h3>
      </Tooltip>
      <div className="flex items-center gap-1.5">
        {loadingHistory && (
          <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/15 text-yellow-400 animate-pulse">
            Loading...
          </span>
        )}
        <span className={`text-xs px-2 py-1 rounded-full ${isListening ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}`}>
          {isListening ? "Live" : "Offline"}
        </span>
      </div>
    </div>
  );
}

function TimelineEventRow({ event, token }: { event: TimelineEvent; token: TokenInfo }) {
  const { dot, content } = getTimelineRowContent(event, token);

  return (
    <div className="flex items-center gap-2 pl-1 py-0.5">
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
      <span className="text-xs leading-relaxed">{content}</span>
    </div>
  );
}

function getTimelineRowContent(event: TimelineEvent, token: TokenInfo): { dot: string; content: React.ReactNode } {
  switch (event.type) {
    case "hand_started":
      return {
        dot: "bg-[var(--status-info)]",
        content: (
          <span className="text-[var(--text-secondary)]">
            Hand started — Dealer seat {event.dealerPosition + 1}, Blinds{" "}
            <span className="text-[var(--text-primary)]">
              {baseUnitsToDisplay(event.smallBlindAmount, token).toFixed(2)}/{baseUnitsToDisplay(event.bigBlindAmount, token).toFixed(2)}
            </span>
          </span>
        ),
      };

    case "action_taken": {
      const phaseName = PHASE_NAMES[event.phase] || "?";
      const actionName = ACTION_NAMES[event.actionType] || "?";
      const amountStr = event.amount > 0
        ? ` ${baseUnitsToDisplay(event.amount, token).toFixed(2)}`
        : "";

      return {
        dot: getActionDotColor(event.actionType),
        content: (
          <>
            <span className="text-[var(--text-muted)]">[{phaseName}]</span>{" "}
            <span className="text-[var(--text-secondary)]">Seat {event.seatIndex + 1}:</span>{" "}
            <span className={getActionTextColor(event.actionType)}>{actionName}{amountStr}</span>
          </>
        ),
      };
    }

    case "community_cards": {
      const phaseName = PHASE_NAMES[event.newPhase] || "?";
      return {
        dot: "bg-purple-400",
        content: (
          <>
            <span className="text-purple-400">{phaseName}</span>{" "}
            <span className="font-mono text-sm font-semibold">
              [{event.cards.map((c, i) => (
                <span key={i}>
                  {i > 0 && ", "}
                  <span className={getSuitColor(c)}>{formatCard(c)}</span>
                </span>
              ))}]
            </span>
          </>
        ),
      };
    }

    case "showdown_reveal":
      return {
        dot: "bg-cyan-400",
        content: (
          <>
            <span className="text-cyan-400">Seat {event.seatIndex + 1} reveals</span>{" "}
            <span className="font-mono text-sm font-semibold">
              <span className={getSuitColor(event.card1)}>{formatCard(event.card1)}</span>{" "}
              <span className={getSuitColor(event.card2)}>{formatCard(event.card2)}</span>
            </span>
          </>
        ),
      };
  }
}

function getActionDotColor(actionType: number): string {
  switch (actionType) {
    case 0: return "bg-[var(--status-danger)]";   // Fold
    case 1: return "bg-[var(--text-muted)]";       // Check
    case 2: return "bg-[var(--text-secondary)]";   // Call
    case 3: return "bg-[var(--gold-main)]";        // Raise
    case 4: return "bg-purple-400";                // All-In
    case 5: return "bg-[var(--status-danger)]";    // Timeout Fold
    case 6: return "bg-[var(--text-muted)]";       // Timeout Check
    default: return "bg-[var(--text-muted)]";
  }
}

function getActionTextColor(actionType: number): string {
  switch (actionType) {
    case 0: return "text-[var(--status-danger)]";          // Fold
    case 1: return "text-[var(--text-secondary)]";         // Check
    case 2: return "text-[var(--text-secondary)]";         // Call
    case 3: return "text-[var(--gold-light)]";             // Raise
    case 4: return "text-purple-400 font-semibold";        // All-In
    case 5: return "text-[var(--status-danger)] italic";   // Timeout Fold
    case 6: return "text-[var(--text-muted)] italic";      // Timeout Check
    default: return "text-[var(--text-secondary)]";
  }
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < SECONDS_PER_MINUTE) return `${seconds}s ago`;
  if (seconds < SECONDS_PER_HOUR) return `${Math.floor(seconds / SECONDS_PER_MINUTE)}m ago`;
  if (seconds < SECONDS_PER_DAY) return `${Math.floor(seconds / SECONDS_PER_HOUR)}h ago`;
  return date.toLocaleDateString();
}
