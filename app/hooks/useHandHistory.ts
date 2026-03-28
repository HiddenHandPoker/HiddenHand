"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Program, BN, Idl } from "@coral-xyz/anchor";

// Hand rank names matching the Rust enum order
const HAND_RANKS = [
  "High Card",
  "Pair",
  "Two Pair",
  "Three of a Kind",
  "Straight",
  "Flush",
  "Full House",
  "Four of a Kind",
  "Straight Flush",
  "Royal Flush",
];

// Phase names matching Rust GamePhase discriminants
const PHASE_NAMES = ["Dealing", "PreFlop", "Flop", "Turn", "River", "Showdown", "Settled"];

// Action type names matching Rust encoding
const ACTION_NAMES = ["Fold", "Check", "Call", "Raise", "All-In", "Timeout Fold", "Timeout Check"];

// Event discriminators (first 8 bytes of SHA-256("event:<EventName>"))
const EVENT_DISCRIMINATORS = {
  HandCompleted:          [0x54, 0x0b, 0x52, 0x62, 0x09, 0x4a, 0xc8, 0xe5],
  HandStarted:            [0x5c, 0x73, 0x87, 0x67, 0x85, 0xa9, 0x8f, 0x2b],
  ActionTaken:            [0x80, 0xba, 0x4d, 0x0c, 0x63, 0xc3, 0x30, 0x3c],
  CommunityCardsRevealed: [0xc2, 0xff, 0x4e, 0x04, 0x74, 0x5f, 0x16, 0xb4],
  ShowdownReveal:         [0x57, 0x83, 0x25, 0x8d, 0xc7, 0xc0, 0x5c, 0xb2],
} as const;

// --- Types ---

export interface PlayerResult {
  player: string;
  seatIndex: number;
  holeCards: [number, number] | null;
  handRank: string | null;
  chipsWon: number;
  chipsBet: number;
  folded: boolean;
  allIn: boolean;
}

export interface HandHistoryEntry {
  handNumber: number;
  timestamp: Date;
  communityCards: number[];
  totalPot: number;
  players: PlayerResult[];
  signature?: string;
}

interface BaseTimelineEvent {
  timestamp: Date;
  signature?: string;
}

export interface HandStartedTimelineEvent extends BaseTimelineEvent {
  type: "hand_started";
  dealerPosition: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  smallBlindAmount: number;
  bigBlindAmount: number;
  activePlayers: number;
  playerCount: number;
}

export interface ActionTakenTimelineEvent extends BaseTimelineEvent {
  type: "action_taken";
  seatIndex: number;
  actionType: number;
  amount: number;
  potAfter: number;
  phase: number;
  nextActionOn: number;
}

export interface CommunityCardsTimelineEvent extends BaseTimelineEvent {
  type: "community_cards";
  newPhase: number;
  cards: number[];
  actionOn: number;
}

export interface ShowdownRevealTimelineEvent extends BaseTimelineEvent {
  type: "showdown_reveal";
  seatIndex: number;
  card1: number;
  card2: number;
}

export type TimelineEvent =
  | HandStartedTimelineEvent
  | ActionTakenTimelineEvent
  | CommunityCardsTimelineEvent
  | ShowdownRevealTimelineEvent;

// --- Helpers ---

function readU64LE(data: Uint8Array, offset: number): number {
  const view = new DataView(data.buffer, data.byteOffset + offset, 8);
  const lo = view.getUint32(0, true);
  const hi = view.getUint32(4, true);
  return lo + hi * 0x100000000;
}

function readI64LE(data: Uint8Array, offset: number): number {
  const view = new DataView(data.buffer, data.byteOffset + offset, 8);
  const lo = view.getUint32(0, true);
  const hi = view.getInt32(4, true);
  return lo + hi * 0x100000000;
}

function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function matchDisc(data: Uint8Array, expected: readonly number[]): boolean {
  if (data.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (data[i] !== expected[i]) return false;
  }
  return true;
}

// --- Binary parsers ---

// HandCompleted layout:
// table_id[32] + hand_number[8] + timestamp[8] + community_cards[5] + total_pot[8] + player_count[1]
// + results[6 * 54] + results_count[1]
// PlayerHandResult (54 bytes): player[32] + seat_index[1] + hole_card_1[1] + hole_card_2[1] + hand_rank[1]
//   + chips_won[8] + chips_bet[8] + folded[1] + all_in[1]
function parseHandCompletedFromBuffer(data: Uint8Array, signature: string): HandHistoryEntry | null {
  try {
    let offset = 32; // skip table_id
    const handNumber = readU64LE(data, offset); offset += 8;
    const timestamp = readI64LE(data, offset); offset += 8;

    const communityCards: number[] = [];
    for (let i = 0; i < 5; i++) {
      const card = data[offset + i];
      if (card !== 255) communityCards.push(card);
    }
    offset += 5;

    const totalPot = readU64LE(data, offset); offset += 8;
    offset += 1; // player_count (skip, use results_count instead)

    const PLAYER_RESULT_SIZE = 54;
    const resultsCountOffset = offset + (6 * PLAYER_RESULT_SIZE);
    const resultsCount = data[resultsCountOffset];

    const players: PlayerResult[] = [];
    for (let i = 0; i < resultsCount; i++) {
      const r = offset + (i * PLAYER_RESULT_SIZE);
      const playerBytes = data.slice(r, r + 32);
      const player = new PublicKey(playerBytes).toString();
      const seatIndex = data[r + 32];
      const holeCard1 = data[r + 33];
      const holeCard2 = data[r + 34];
      const handRankNum = data[r + 35];
      const chipsWon = readU64LE(data, r + 36);
      const chipsBet = readU64LE(data, r + 44);
      const folded = data[r + 52] !== 0;
      const allIn = data[r + 53] !== 0;

      players.push({
        player,
        seatIndex,
        holeCards: holeCard1 !== 255 && holeCard2 !== 255 ? [holeCard1, holeCard2] : null,
        handRank: handRankNum !== 255 ? HAND_RANKS[handRankNum] || null : null,
        chipsWon,
        chipsBet,
        folded,
        allIn,
      });
    }

    return { handNumber, timestamp: new Date(timestamp * 1000), communityCards, totalPot, players, signature };
  } catch (e) {
    console.error("[HandHistory] HandCompleted parse error:", e);
    return null;
  }
}

// HandStarted layout: table_id[32] + hand_number[8] + timestamp[8] + dealer_position[1]
//   + small_blind_seat[1] + big_blind_seat[1] + small_blind_amount[8] + big_blind_amount[8]
//   + active_players[1] + player_count[1]
function parseHandStartedFromBuffer(data: Uint8Array, signature: string): { handNumber: number; event: HandStartedTimelineEvent } | null {
  try {
    let offset = 32;
    const handNumber = readU64LE(data, offset); offset += 8;
    const timestamp = readI64LE(data, offset); offset += 8;
    const dealerPosition = data[offset++];
    const smallBlindSeat = data[offset++];
    const bigBlindSeat = data[offset++];
    const smallBlindAmount = readU64LE(data, offset); offset += 8;
    const bigBlindAmount = readU64LE(data, offset); offset += 8;
    const activePlayers = data[offset++];
    const playerCount = data[offset++];
    return {
      handNumber,
      event: { type: "hand_started", timestamp: new Date(timestamp * 1000), signature, dealerPosition, smallBlindSeat, bigBlindSeat, smallBlindAmount, bigBlindAmount, activePlayers, playerCount },
    };
  } catch (e) {
    console.error("[HandHistory] HandStarted parse error:", e);
    return null;
  }
}

// ActionTaken layout: table_id[32] + hand_number[8] + seat_index[1] + action_type[1]
//   + amount[8] + pot_after[8] + phase[1] + timestamp[8] + next_action_on[1]
function parseActionTakenFromBuffer(data: Uint8Array, signature: string): { handNumber: number; event: ActionTakenTimelineEvent } | null {
  try {
    let offset = 32;
    const handNumber = readU64LE(data, offset); offset += 8;
    const seatIndex = data[offset++];
    const actionType = data[offset++];
    const amount = readU64LE(data, offset); offset += 8;
    const potAfter = readU64LE(data, offset); offset += 8;
    const phase = data[offset++];
    const timestamp = readI64LE(data, offset); offset += 8;
    const nextActionOn = data[offset++];
    return {
      handNumber,
      event: { type: "action_taken", timestamp: new Date(timestamp * 1000), signature, seatIndex, actionType, amount, potAfter, phase, nextActionOn },
    };
  } catch (e) {
    console.error("[HandHistory] ActionTaken parse error:", e);
    return null;
  }
}

// CommunityCardsRevealed layout: table_id[32] + hand_number[8] + new_phase[1]
//   + cards_len[4] + cards[N] + timestamp[8] + action_on[1]
function parseCommunityCardsFromBuffer(data: Uint8Array, signature: string): { handNumber: number; event: CommunityCardsTimelineEvent } | null {
  try {
    let offset = 32;
    const handNumber = readU64LE(data, offset); offset += 8;
    const newPhase = data[offset++];
    const cardsLen = data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24);
    offset += 4;
    const cards: number[] = [];
    for (let i = 0; i < cardsLen; i++) cards.push(data[offset++]);
    const timestamp = readI64LE(data, offset); offset += 8;
    const actionOn = data[offset++];
    return {
      handNumber,
      event: { type: "community_cards", timestamp: new Date(timestamp * 1000), signature, newPhase, cards, actionOn },
    };
  } catch (e) {
    console.error("[HandHistory] CommunityCardsRevealed parse error:", e);
    return null;
  }
}

// ShowdownReveal layout: table_id[32] + hand_number[8] + seat_index[1] + card_1[1] + card_2[1] + timestamp[8]
function parseShowdownRevealFromBuffer(data: Uint8Array, signature: string): { handNumber: number; event: ShowdownRevealTimelineEvent } | null {
  try {
    let offset = 32;
    const handNumber = readU64LE(data, offset); offset += 8;
    const seatIndex = data[offset++];
    const card1 = data[offset++];
    const card2 = data[offset++];
    const timestamp = readI64LE(data, offset); offset += 8;
    return {
      handNumber,
      event: { type: "showdown_reveal", timestamp: new Date(timestamp * 1000), signature, seatIndex, card1, card2 },
    };
  } catch (e) {
    console.error("[HandHistory] ShowdownReveal parse error:", e);
    return null;
  }
}

// Parse all events from a single "Program data:" log line
// Returns any events found (may be empty)
function parseEventsFromDataLog(
  dataLog: string,
  signature: string,
): { hands: HandHistoryEntry[]; timeline: { handNumber: number; event: TimelineEvent }[] } {
  const hands: HandHistoryEntry[] = [];
  const timeline: { handNumber: number; event: TimelineEvent }[] = [];

  try {
    const base64Data = dataLog.replace("Program data: ", "");
    const bytes = base64ToBytes(base64Data);
    if (bytes.length < 8) return { hands, timeline };

    const disc = bytes.slice(0, 8);
    const eventData = bytes.slice(8);

    if (matchDisc(disc, EVENT_DISCRIMINATORS.HandCompleted)) {
      const entry = parseHandCompletedFromBuffer(eventData, signature);
      if (entry) hands.push(entry);
    } else if (matchDisc(disc, EVENT_DISCRIMINATORS.HandStarted)) {
      const parsed = parseHandStartedFromBuffer(eventData, signature);
      if (parsed) timeline.push(parsed);
    } else if (matchDisc(disc, EVENT_DISCRIMINATORS.ActionTaken)) {
      const parsed = parseActionTakenFromBuffer(eventData, signature);
      if (parsed) timeline.push(parsed);
    } else if (matchDisc(disc, EVENT_DISCRIMINATORS.CommunityCardsRevealed)) {
      const parsed = parseCommunityCardsFromBuffer(eventData, signature);
      if (parsed) timeline.push(parsed);
    } else if (matchDisc(disc, EVENT_DISCRIMINATORS.ShowdownReveal)) {
      const parsed = parseShowdownRevealFromBuffer(eventData, signature);
      if (parsed) timeline.push(parsed);
    }
  } catch {
    // Skip unparseable
  }

  return { hands, timeline };
}

// --- Hook ---

export function useHandHistory(program: Program<Idl> | null, tablePDA?: PublicKey | null) {
  const { connection } = useConnection();
  const [history, setHistory] = useState<HandHistoryEntry[]>([]);
  const [handTimelines, setHandTimelines] = useState<Map<number, TimelineEvent[]>>(new Map());
  const [isListening, setIsListening] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const listenerIdsRef = useRef<number[]>([]);
  const logListenerIdRef = useRef<number | null>(null);
  const historyFetchedRef = useRef<string | null>(null);

  const addTimelineEvent = useCallback((handNumber: number, event: TimelineEvent) => {
    setHandTimelines(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(handNumber) || [];
      const isDuplicate = existing.some(
        e => e.type === event.type && e.timestamp.getTime() === event.timestamp.getTime()
          && (e.type !== "action_taken" || (e as ActionTakenTimelineEvent).seatIndex === (event as ActionTakenTimelineEvent).seatIndex)
      );
      if (!isDuplicate) {
        newMap.set(handNumber, [...existing, event]);
      }
      return newMap;
    });
  }, []);

  // Parse Anchor-decoded HandCompleted event data
  const parseEventData = useCallback((eventData: any, signature?: string): HandHistoryEntry => {
    const players: PlayerResult[] = [];
    const resultsCount = eventData.resultsCount || eventData.results_count || 0;

    for (let i = 0; i < resultsCount; i++) {
      const result = eventData.results[i];
      if (!result) continue;

      const holeCard1 = result.holeCard1 ?? result.hole_card_1;
      const holeCard2 = result.holeCard2 ?? result.hole_card_2;
      const handRankNum = result.handRank ?? result.hand_rank;

      players.push({
        player: result.player?.toString() || "",
        seatIndex: result.seatIndex ?? result.seat_index ?? 0,
        holeCards: holeCard1 !== 255 && holeCard2 !== 255 ? [holeCard1, holeCard2] : null,
        handRank: handRankNum !== 255 ? HAND_RANKS[handRankNum] || null : null,
        chipsWon: Number(result.chipsWon ?? result.chips_won ?? 0),
        chipsBet: Number(result.chipsBet ?? result.chips_bet ?? 0),
        folded: result.folded ?? false,
        allIn: result.allIn ?? result.all_in ?? false,
      });
    }

    const communityCards = (eventData.communityCards ?? eventData.community_cards ?? [])
      .filter((c: number) => c !== 255);

    return {
      handNumber: Number(eventData.handNumber ?? eventData.hand_number ?? 0),
      timestamp: new Date(Number(eventData.timestamp ?? 0) * 1000),
      communityCards,
      totalPot: Number(eventData.totalPot ?? eventData.total_pot ?? 0),
      players,
      signature,
    };
  }, []);

  // --- Historical reconstruction ---

  const fetchHistoricalEvents = useCallback(async () => {
    if (!tablePDA || !connection) return;

    const pdaStr = tablePDA.toString();
    if (historyFetchedRef.current === pdaStr) return;
    historyFetchedRef.current = pdaStr;

    setLoadingHistory(true);
    console.log("[HandHistory] Fetching historical events for table:", pdaStr);

    try {
      const signatures = await connection.getSignaturesForAddress(tablePDA, { limit: 200 });
      if (signatures.length === 0) {
        console.log("[HandHistory] No historical transactions found");
        setLoadingHistory(false);
        return;
      }

      // Process oldest first so timelines build in chronological order
      const sigList = [...signatures].reverse().map(s => s.signature);

      const historicalHands: HandHistoryEntry[] = [];
      const historicalTimelines = new Map<number, TimelineEvent[]>();

      const BATCH_SIZE = 20;
      for (let i = 0; i < sigList.length; i += BATCH_SIZE) {
        const batch = sigList.slice(i, i + BATCH_SIZE);

        let txs: (any | null)[];
        try {
          txs = await connection.getParsedTransactions(batch, {
            maxSupportedTransactionVersion: 0,
          });
        } catch (e) {
          console.warn("[HandHistory] Batch fetch error, skipping batch:", e);
          continue;
        }

        for (let j = 0; j < txs.length; j++) {
          const tx = txs[j];
          if (!tx?.meta?.logMessages) continue;

          const sig = batch[j];
          const dataLogs = tx.meta.logMessages.filter((log: string) => log.startsWith("Program data:"));

          for (const dataLog of dataLogs) {
            const { hands, timeline } = parseEventsFromDataLog(dataLog, sig);

            for (const hand of hands) {
              if (!historicalHands.some(h => h.handNumber === hand.handNumber)) {
                historicalHands.push(hand);
              }
            }

            for (const { handNumber, event } of timeline) {
              const existing = historicalTimelines.get(handNumber) || [];
              existing.push(event);
              historicalTimelines.set(handNumber, existing);
            }
          }
        }
      }

      // Merge hands into state
      if (historicalHands.length > 0) {
        setHistory(prev => {
          const merged = [...historicalHands];
          for (const h of prev) {
            if (!merged.some(m => m.handNumber === h.handNumber)) {
              merged.push(h);
            }
          }
          merged.sort((a, b) => b.handNumber - a.handNumber);
          return merged.slice(0, 50);
        });
      }

      // Merge timelines into state
      if (historicalTimelines.size > 0) {
        setHandTimelines(prev => {
          const merged = new Map(prev);
          for (const [handNumber, events] of historicalTimelines) {
            const existing = merged.get(handNumber) || [];
            for (const event of events) {
              const isDuplicate = existing.some(
                e => e.type === event.type && e.timestamp.getTime() === event.timestamp.getTime()
              );
              if (!isDuplicate) existing.push(event);
            }
            merged.set(handNumber, existing);
          }
          return merged;
        });
      }

      console.log(
        `[HandHistory] Loaded ${historicalHands.length} completed hands and ${historicalTimelines.size} hand timelines from ${sigList.length} transactions`
      );
    } catch (error) {
      console.error("[HandHistory] Failed to fetch historical events:", error);
    } finally {
      setLoadingHistory(false);
    }
  }, [tablePDA, connection]);

  // --- Real-time listeners ---

  const startListening = useCallback(() => {
    if (!program || isListening) return;

    try {
      console.log("[HandHistory] Starting event listeners...");

      // Anchor addEventListener for each event type
      const handCompletedId = program.addEventListener("HandCompleted" as any, (event: any, slot: number, signature: string) => {
        const entry = parseEventData(event, signature);
        setHistory(prev => {
          if (prev.some(h => h.handNumber === entry.handNumber)) return prev;
          return [entry, ...prev].slice(0, 50);
        });
      });
      listenerIdsRef.current.push(handCompletedId);

      const handStartedId = program.addEventListener("HandStarted" as any, (event: any, slot: number, signature: string) => {
        const handNumber = Number(event.handNumber ?? event.hand_number ?? 0);
        addTimelineEvent(handNumber, {
          type: "hand_started",
          timestamp: new Date(Number(event.timestamp ?? 0) * 1000),
          signature,
          dealerPosition: event.dealerPosition ?? event.dealer_position ?? 0,
          smallBlindSeat: event.smallBlindSeat ?? event.small_blind_seat ?? 0,
          bigBlindSeat: event.bigBlindSeat ?? event.big_blind_seat ?? 0,
          smallBlindAmount: Number(event.smallBlindAmount ?? event.small_blind_amount ?? 0),
          bigBlindAmount: Number(event.bigBlindAmount ?? event.big_blind_amount ?? 0),
          activePlayers: event.activePlayers ?? event.active_players ?? 0,
          playerCount: event.playerCount ?? event.player_count ?? 0,
        });
      });
      listenerIdsRef.current.push(handStartedId);

      const actionTakenId = program.addEventListener("ActionTaken" as any, (event: any, slot: number, signature: string) => {
        const handNumber = Number(event.handNumber ?? event.hand_number ?? 0);
        addTimelineEvent(handNumber, {
          type: "action_taken",
          timestamp: new Date(Number(event.timestamp ?? 0) * 1000),
          signature,
          seatIndex: event.seatIndex ?? event.seat_index ?? 0,
          actionType: event.actionType ?? event.action_type ?? 0,
          amount: Number(event.amount ?? 0),
          potAfter: Number(event.potAfter ?? event.pot_after ?? 0),
          phase: event.phase ?? 0,
          nextActionOn: event.nextActionOn ?? event.next_action_on ?? 255,
        });
      });
      listenerIdsRef.current.push(actionTakenId);

      const communityId = program.addEventListener("CommunityCardsRevealed" as any, (event: any, slot: number, signature: string) => {
        const handNumber = Number(event.handNumber ?? event.hand_number ?? 0);
        addTimelineEvent(handNumber, {
          type: "community_cards",
          timestamp: new Date(Number(event.timestamp ?? 0) * 1000),
          signature,
          newPhase: event.newPhase ?? event.new_phase ?? 0,
          cards: event.cards ?? [],
          actionOn: event.actionOn ?? event.action_on ?? 255,
        });
      });
      listenerIdsRef.current.push(communityId);

      const showdownId = program.addEventListener("ShowdownReveal" as any, (event: any, slot: number, signature: string) => {
        const handNumber = Number(event.handNumber ?? event.hand_number ?? 0);
        addTimelineEvent(handNumber, {
          type: "showdown_reveal",
          timestamp: new Date(Number(event.timestamp ?? 0) * 1000),
          signature,
          seatIndex: event.seatIndex ?? event.seat_index ?? 0,
          card1: event.card1 ?? event.card_1 ?? 255,
          card2: event.card2 ?? event.card_2 ?? 255,
        });
      });
      listenerIdsRef.current.push(showdownId);

      setIsListening(true);
      console.log("[HandHistory] Anchor event listeners started");

      // Log-based fallback for real-time events
      try {
        const logListenerId = connection.onLogs(
          program.programId,
          async (logs) => {
            const dataLogs = logs.logs.filter(log => log.startsWith("Program data:"));
            for (const dataLog of dataLogs) {
              const { hands, timeline } = parseEventsFromDataLog(dataLog, logs.signature);

              for (const hand of hands) {
                setHistory(prev => {
                  if (prev.some(h => h.handNumber === hand.handNumber)) return prev;
                  return [hand, ...prev].slice(0, 50);
                });
              }
              for (const { handNumber, event } of timeline) {
                addTimelineEvent(handNumber, event);
              }
            }
          },
          "confirmed"
        );
        logListenerIdRef.current = logListenerId;
        console.log("[HandHistory] Log-based fallback listener started");
      } catch (logError) {
        console.warn("[HandHistory] Could not subscribe to logs:", logError);
      }
    } catch (error) {
      console.error("[HandHistory] Failed to start event listeners:", error);
    }
  }, [program, isListening, parseEventData, addTimelineEvent, connection]);

  const stopListening = useCallback(() => {
    for (const id of listenerIdsRef.current) {
      try { program?.removeEventListener(id); } catch { /* ignore */ }
    }
    listenerIdsRef.current = [];

    if (logListenerIdRef.current !== null) {
      try { connection.removeOnLogsListener(logListenerIdRef.current); } catch { /* ignore */ }
      logListenerIdRef.current = null;
    }

    setIsListening(false);
  }, [program, connection]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setHandTimelines(new Map());
    historyFetchedRef.current = null;
  }, []);

  // Auto-start real-time listeners
  useEffect(() => {
    if (program && !isListening) {
      startListening();
    }
    return () => {
      if (isListening) stopListening();
    };
  }, [program, isListening, startListening, stopListening]);

  // Auto-fetch historical events when tablePDA is available
  useEffect(() => {
    if (tablePDA) {
      fetchHistoricalEvents();
    }
  }, [tablePDA, fetchHistoricalEvents]);

  return {
    history,
    handTimelines,
    isListening,
    loadingHistory,
    startListening,
    stopListening,
    clearHistory,
  };
}

// --- Exported helpers ---

export function formatCard(cardNum: number): string {
  if (cardNum === 255 || cardNum < 0 || cardNum > 51) return "?";
  const suits = ["\u2665", "\u2666", "\u2663", "\u2660"];
  const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const suit = Math.floor(cardNum / 13);
  const rank = cardNum % 13;
  return `${ranks[rank]}${suits[suit]}`;
}

export function getSuitColor(cardNum: number): string {
  if (cardNum === 255 || cardNum < 0 || cardNum > 51) return "text-gray-500";
  const suit = Math.floor(cardNum / 13);
  return suit <= 1 ? "text-red-500" : "text-white";
}

export { PHASE_NAMES, ACTION_NAMES };
