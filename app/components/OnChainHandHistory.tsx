"use client";

import { useState } from "react";
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
          <span className={`text-xs px-2 py-1 rounded-full ${isListening ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}`}>
            {isListening ? "Live" : "Offline"}
          </span>
        </div>
        {loadingHistory ? (
          <p className="text-sm text-[var(--text-secondary)]">
            Loading hand history from chain...
          </p>
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
        <span className={`text-xs px-2 py-1 rounded-full ${isListening ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}`}>
          {isListening ? "Live" : "Offline"}
        </span>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {history.map((hand, idx) => {
          const timeline = handTimelines.get(hand.handNumber) || [];
          const isExpanded = expandedHands.has(hand.handNumber);

          return (
            <div
              key={`${hand.handNumber}-${idx}`}
              className="bg-black/20 rounded-lg p-3 border border-white/5"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
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
                  {timeline.length > 0 && (
                    <button
                      onClick={() => toggleTimeline(hand.handNumber)}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {isExpanded ? "Hide" : "Show"} Log
                    </button>
                  )}
                </div>
              </div>

              {/* Pot */}
              <div className="text-xs text-[var(--text-secondary)] mb-2">
                Pot: <span className="text-[var(--gold)]">{baseUnitsToDisplay(hand.totalPot, token).toFixed(2)} {token.symbol}</span>
              </div>

              {/* Timeline (expanded) */}
              {isExpanded && timeline.length > 0 && (
                <div className="mb-2 pl-1 border-l-2 border-white/10 space-y-0.5">
                  {timeline.map((event, i) => (
                    <TimelineEventRow key={i} event={event} token={token} isLast={i === timeline.length - 1} />
                  ))}
                  {/* Hand completed summary with actual winnings */}
                  {(() => {
                    const winners = hand.players.filter(p => p.chipsWon > 0);
                    if (winners.length === 0) return null;
                    return (
                      <div className="flex items-start gap-1.5 pl-2 py-0.5">
                        <span className="text-[10px] text-green-400 font-mono leading-relaxed">
                          {"\u2514\u2500"} {winners.map((p, i) => (
                            <span key={p.seatIndex}>
                              {i > 0 && ", "}
                              Seat {p.seatIndex} wins {baseUnitsToDisplay(p.chipsWon, token).toFixed(2)} {token.symbol}
                            </span>
                          ))}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}

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

              {/* Explorer Link */}
              {hand.signature && (
                <div className="mt-2 pt-2 border-t border-white/5">
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
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimelineEventRow({ event, token, isLast }: { event: TimelineEvent; token: TokenInfo; isLast: boolean }) {
  const connector = isLast ? "\u2514\u2500" : "\u251c\u2500";

  switch (event.type) {
    case "hand_started":
      return (
        <div className="flex items-start gap-1.5 pl-2 py-0.5">
          <span className="text-[10px] text-[var(--text-secondary)] font-mono leading-relaxed">
            {connector} Hand started: Dealer seat {event.dealerPosition}, Blinds {baseUnitsToDisplay(event.smallBlindAmount, token).toFixed(2)}/{baseUnitsToDisplay(event.bigBlindAmount, token).toFixed(2)}
          </span>
        </div>
      );

    case "action_taken": {
      const phaseName = PHASE_NAMES[event.phase] || "?";
      const actionName = ACTION_NAMES[event.actionType] || "?";
      const amountStr = event.amount > 0
        ? ` ${baseUnitsToDisplay(event.amount, token).toFixed(2)}`
        : "";

      const actionColor = getActionColor(event.actionType);

      return (
        <div className="flex items-start gap-1.5 pl-2 py-0.5">
          <span className="text-[10px] font-mono leading-relaxed">
            <span className="text-[var(--text-muted)]">{connector}</span>{" "}
            <span className="text-[var(--text-muted)]">[{phaseName}]</span>{" "}
            <span className="text-[var(--text-secondary)]">Seat {event.seatIndex}:</span>{" "}
            <span className={actionColor}>{actionName}{amountStr}</span>
          </span>
        </div>
      );
    }

    case "community_cards": {
      const phaseName = PHASE_NAMES[event.newPhase] || "?";
      return (
        <div className="flex items-start gap-1.5 pl-2 py-0.5">
          <span className="text-[10px] font-mono leading-relaxed">
            <span className="text-[var(--text-muted)]">{connector}</span>{" "}
            <span className="text-purple-400">Community: {phaseName}</span>{" "}
            <span className="text-base font-semibold">
              [{event.cards.map((c, i) => (
                <span key={i}>
                  {i > 0 && ", "}
                  <span className={getSuitColor(c)}>{formatCard(c)}</span>
                </span>
              ))}]
            </span>
          </span>
        </div>
      );
    }

    case "showdown_reveal":
      return (
        <div className="flex items-start gap-1.5 pl-2 py-0.5">
          <span className="text-[10px] font-mono leading-relaxed">
            <span className="text-[var(--text-muted)]">{connector}</span>{" "}
            <span className="text-cyan-400">Seat {event.seatIndex} reveals:</span>{" "}
            <span className="text-base font-semibold">
              <span className={getSuitColor(event.card1)}>{formatCard(event.card1)}</span>{" "}
              <span className={getSuitColor(event.card2)}>{formatCard(event.card2)}</span>
            </span>
          </span>
        </div>
      );
  }
}

function getActionColor(actionType: number): string {
  switch (actionType) {
    case 0: return "text-red-400"; // Fold
    case 1: return "text-[var(--text-secondary)]"; // Check
    case 2: return "text-[var(--text-secondary)]"; // Call
    case 3: return "text-[var(--gold-light)]"; // Raise
    case 4: return "text-purple-400 font-semibold"; // All-In
    case 5: return "text-red-400 italic"; // Timeout Fold
    case 6: return "text-[var(--text-muted)] italic"; // Timeout Check
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

