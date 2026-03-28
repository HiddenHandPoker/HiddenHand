"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "@/lib/program";

// ─── Event discriminators (first 8 bytes of SHA-256("event:<EventName>")) ───
const DISC = {
  HandCompleted: [0x54, 0x0b, 0x52, 0x62, 0x09, 0x4a, 0xc8, 0xe5],
  HandStarted: [0x5c, 0x73, 0x87, 0x67, 0x85, 0xa9, 0x8f, 0x2b],
  ActionTaken: [0x80, 0xba, 0x4d, 0x0c, 0x63, 0xc3, 0x30, 0x3c],
} as const;

// ─── Binary helpers ───

function readU64LE(data: Uint8Array, offset: number): number {
  const view = new DataView(data.buffer, data.byteOffset + offset, 8);
  return view.getUint32(0, true) + view.getUint32(4, true) * 0x100000000;
}

function readI64LE(data: Uint8Array, offset: number): number {
  const view = new DataView(data.buffer, data.byteOffset + offset, 8);
  return view.getUint32(0, true) + view.getInt32(4, true) * 0x100000000;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function matchDisc(data: Uint8Array, expected: readonly number[]): boolean {
  if (data.length < 8) return false;
  for (let i = 0; i < 8; i++) if (data[i] !== expected[i]) return false;
  return true;
}

// ─── Parsed event types ───

interface HandCompletedResult {
  player: string;
  seatIndex: number;
  handRank: number;
  chipsWon: number;
  chipsBet: number;
  folded: boolean;
  allIn: boolean;
}

interface ParsedHandCompleted {
  type: "HandCompleted";
  tableId: Uint8Array;
  handNumber: number;
  timestamp: number;
  totalPot: number;
  results: HandCompletedResult[];
}

interface ParsedActionTaken {
  type: "ActionTaken";
  tableId: Uint8Array;
  handNumber: number;
  seatIndex: number;
  actionType: number; // 0=Fold,1=Check,2=Call,3=Raise,4=AllIn,5=TimeoutFold,6=TimeoutCheck
  amount: number;
  phase: number; // 0=Dealing,1=PreFlop,2=Flop,3=Turn,4=River,5=Showdown,6=Settled
  timestamp: number;
}

interface ParsedHandStarted {
  type: "HandStarted";
  tableId: Uint8Array;
  handNumber: number;
  timestamp: number;
  smallBlindAmount: number;
  bigBlindAmount: number;
  activePlayers: number; // bitmap
  playerCount: number;
}

type ParsedEvent = ParsedHandCompleted | ParsedActionTaken | ParsedHandStarted;

// ─── Binary parsers ───

function parseHandCompleted(data: Uint8Array): ParsedHandCompleted | null {
  try {
    const tableId = data.slice(0, 32);
    let offset = 32;
    const handNumber = readU64LE(data, offset); offset += 8;
    const timestamp = readI64LE(data, offset); offset += 8;
    offset += 5; // community_cards[5] — skip
    const totalPot = readU64LE(data, offset); offset += 8;
    offset += 1; // player_count — skip

    const RESULT_SIZE = 54;
    const resultsCountOffset = offset + 6 * RESULT_SIZE;
    const resultsCount = data[resultsCountOffset];

    const results: HandCompletedResult[] = [];
    for (let i = 0; i < resultsCount; i++) {
      const r = offset + i * RESULT_SIZE;
      const player = new PublicKey(data.slice(r, r + 32)).toString();
      results.push({
        player,
        seatIndex: data[r + 32],
        handRank: data[r + 35],
        chipsWon: readU64LE(data, r + 36),
        chipsBet: readU64LE(data, r + 44),
        folded: data[r + 52] !== 0,
        allIn: data[r + 53] !== 0,
      });
    }

    return { type: "HandCompleted", tableId, handNumber, timestamp, totalPot, results };
  } catch {
    return null;
  }
}

function parseActionTaken(data: Uint8Array): ParsedActionTaken | null {
  try {
    const tableId = data.slice(0, 32);
    let offset = 32;
    const handNumber = readU64LE(data, offset); offset += 8;
    const seatIndex = data[offset++];
    const actionType = data[offset++];
    const amount = readU64LE(data, offset); offset += 8;
    offset += 8; // pot_after — skip
    const phase = data[offset++];
    const timestamp = readI64LE(data, offset); offset += 8;
    return { type: "ActionTaken", tableId, handNumber, seatIndex, actionType, amount, phase, timestamp };
  } catch {
    return null;
  }
}

function parseHandStarted(data: Uint8Array): ParsedHandStarted | null {
  try {
    const tableId = data.slice(0, 32);
    let offset = 32;
    const handNumber = readU64LE(data, offset); offset += 8;
    const timestamp = readI64LE(data, offset); offset += 8;
    offset += 1; // dealer_position
    offset += 1; // small_blind_seat
    offset += 1; // big_blind_seat
    const smallBlindAmount = readU64LE(data, offset); offset += 8;
    const bigBlindAmount = readU64LE(data, offset); offset += 8;
    const activePlayers = data[offset++];
    const playerCount = data[offset++];
    return { type: "HandStarted", tableId, handNumber, timestamp, smallBlindAmount, bigBlindAmount, activePlayers, playerCount };
  } catch {
    return null;
  }
}

function parseEventFromLog(dataLog: string): ParsedEvent | null {
  try {
    const b64 = dataLog.replace("Program data: ", "");
    const bytes = base64ToBytes(b64);
    if (bytes.length < 8) return null;

    const disc = bytes.slice(0, 8);
    const body = bytes.slice(8);

    if (matchDisc(disc, DISC.HandCompleted)) return parseHandCompleted(body);
    if (matchDisc(disc, DISC.ActionTaken)) return parseActionTaken(body);
    if (matchDisc(disc, DISC.HandStarted)) return parseHandStarted(body);
    return null;
  } catch {
    return null;
  }
}

// ─── Stats types ───

export interface PlayerStats {
  wallet: string;
  handsPlayed: number;
  handsWon: number;
  totalProfit: number; // chips_won - chips_bet, in base units (can be negative)
  biggestPotWon: number;
  vpipHands: number; // hands where player voluntarily put money in preflop
  pfrHands: number; // hands where player raised/allin preflop
  showdownCount: number; // hands that went to showdown (player not folded)
  showdownWins: number; // of those, how many won
  aggressiveActions: number; // raise + allin across all streets
  passiveActions: number; // call across all streets
  foldCount: number; // total hands where player folded
  firstHandTimestamp: number; // earliest hand timestamp
  lastHandTimestamp: number; // latest hand timestamp
  // Per-hand profit timeline for chart
  profitTimeline: { handNumber: number; profit: number; cumulative: number }[];
}

export interface LeaderboardEntry {
  wallet: string;
  stats: PlayerStats;
  rank: number;
}

export type TimePeriod = "all" | "month" | "week";

// ─── Aggregation engine ───

// Hand key for deduplication: tableId (hex) + handNumber
function handKey(tableId: Uint8Array, handNumber: number): string {
  let hex = "";
  for (let i = 0; i < 4; i++) hex += tableId[i].toString(16).padStart(2, "0");
  return `${hex}_${handNumber}`;
}

// Seat-to-wallet mapping for a hand (from HandCompleted results)
type SeatMap = Map<number, string>; // seatIndex → wallet

interface HandActionData {
  seatMap: SeatMap;
  actions: ParsedActionTaken[];
}

function aggregateStats(
  completedHands: ParsedHandCompleted[],
  handActions: Map<string, HandActionData>,
  periodFilter?: { start: number; end: number },
): Map<string, PlayerStats> {
  const statsMap = new Map<string, PlayerStats>();

  const getOrCreate = (wallet: string): PlayerStats => {
    let s = statsMap.get(wallet);
    if (!s) {
      s = {
        wallet,
        handsPlayed: 0,
        handsWon: 0,
        totalProfit: 0,
        biggestPotWon: 0,
        vpipHands: 0,
        pfrHands: 0,
        showdownCount: 0,
        showdownWins: 0,
        aggressiveActions: 0,
        passiveActions: 0,
        foldCount: 0,
        firstHandTimestamp: Infinity,
        lastHandTimestamp: 0,
        profitTimeline: [],
      };
      statsMap.set(wallet, s);
    }
    return s;
  };

  // Sort hands chronologically for profit timeline
  const sorted = [...completedHands].sort((a, b) => a.timestamp - b.timestamp);

  for (const hand of sorted) {
    // Apply time period filter
    if (periodFilter) {
      if (hand.timestamp < periodFilter.start || hand.timestamp > periodFilter.end) continue;
    }

    const hk = handKey(hand.tableId, hand.handNumber);
    const actionData = handActions.get(hk);

    for (const result of hand.results) {
      const s = getOrCreate(result.player);
      s.handsPlayed++;

      const profit = result.chipsWon - result.chipsBet;
      s.totalProfit += profit;

      if (result.chipsWon > 0) s.handsWon++;
      if (result.chipsWon > s.biggestPotWon) s.biggestPotWon = result.chipsWon;
      if (result.folded) s.foldCount++;

      // Showdown: player didn't fold and hand had a showdown (at least 2 non-folded)
      if (!result.folded) {
        const nonFolded = hand.results.filter(r => !r.folded);
        if (nonFolded.length >= 2) {
          s.showdownCount++;
          if (result.chipsWon > result.chipsBet) s.showdownWins++;
        }
      }

      // Timestamps
      if (hand.timestamp < s.firstHandTimestamp) s.firstHandTimestamp = hand.timestamp;
      if (hand.timestamp > s.lastHandTimestamp) s.lastHandTimestamp = hand.timestamp;

      // Profit timeline
      const prevCumulative = s.profitTimeline.length > 0
        ? s.profitTimeline[s.profitTimeline.length - 1].cumulative
        : 0;
      s.profitTimeline.push({
        handNumber: hand.handNumber,
        profit,
        cumulative: prevCumulative + profit,
      });

      // Action-based stats: VPIP, PFR, AF
      if (actionData) {
        // Find actions by this player in this hand
        // Match by seat index — need to find this player's seat
        const playerSeat = result.seatIndex;
        const playerActions = actionData.actions.filter(a => a.seatIndex === playerSeat);

        // VPIP: any Call/Raise/AllIn in PreFlop (phase=1)
        const preflopActions = playerActions.filter(a => a.phase === 1);
        const hasVpip = preflopActions.some(a => a.actionType === 2 || a.actionType === 3 || a.actionType === 4);
        if (hasVpip) s.vpipHands++;

        // PFR: any Raise/AllIn in PreFlop
        const hasPfr = preflopActions.some(a => a.actionType === 3 || a.actionType === 4);
        if (hasPfr) s.pfrHands++;

        // Aggression Factor: across all streets
        for (const a of playerActions) {
          if (a.actionType === 3 || a.actionType === 4) s.aggressiveActions++;
          if (a.actionType === 2) s.passiveActions++;
        }
      }
    }
  }

  return statsMap;
}

// ─── Computed stat helpers ───

export function getVPIP(s: PlayerStats): number {
  return s.handsPlayed > 0 ? (s.vpipHands / s.handsPlayed) * 100 : 0;
}

export function getPFR(s: PlayerStats): number {
  return s.handsPlayed > 0 ? (s.pfrHands / s.handsPlayed) * 100 : 0;
}

export function getAggressionFactor(s: PlayerStats): number | null {
  if (s.passiveActions === 0) return s.aggressiveActions > 0 ? Infinity : null;
  return s.aggressiveActions / s.passiveActions;
}

export function getWinRate(s: PlayerStats): number {
  // Profit per 100 hands
  return s.handsPlayed > 0 ? (s.totalProfit / s.handsPlayed) * 100 : 0;
}

export function getShowdownWinRate(s: PlayerStats): number {
  return s.showdownCount > 0 ? (s.showdownWins / s.showdownCount) * 100 : 0;
}

export function getWinPercentage(s: PlayerStats): number {
  return s.handsPlayed > 0 ? (s.handsWon / s.handsPlayed) * 100 : 0;
}

// ─── Cache layer ───

const CACHE_KEY_PREFIX = "hh_stats_";
const CACHE_VERSION = 1;

interface StatsCache {
  version: number;
  programId: string;
  lastSignature: string | null;
  completedHands: ParsedHandCompleted[];
  handActions: [string, { seatMap: [number, string][]; actions: ParsedActionTaken[] }][];
}

function getCacheKey(): string {
  return `${CACHE_KEY_PREFIX}${PROGRAM_ID.toString().slice(0, 8)}`;
}

function loadCache(): { completedHands: ParsedHandCompleted[]; handActions: Map<string, HandActionData>; lastSignature: string | null } {
  try {
    const raw = localStorage.getItem(getCacheKey());
    if (!raw) return { completedHands: [], handActions: new Map(), lastSignature: null };

    const cache: StatsCache = JSON.parse(raw);
    if (cache.version !== CACHE_VERSION || cache.programId !== PROGRAM_ID.toString()) {
      return { completedHands: [], handActions: new Map(), lastSignature: null };
    }

    // Reconstruct Maps and Uint8Arrays
    const completedHands = cache.completedHands.map(h => ({
      ...h,
      tableId: new Uint8Array(Object.values(h.tableId)),
    }));

    const handActions = new Map<string, HandActionData>();
    for (const [key, val] of cache.handActions) {
      const seatMap = new Map<number, string>(val.seatMap);
      const actions = val.actions.map(a => ({
        ...a,
        tableId: new Uint8Array(Object.values(a.tableId)),
      }));
      handActions.set(key, { seatMap, actions });
    }

    return { completedHands, handActions, lastSignature: cache.lastSignature };
  } catch {
    return { completedHands: [], handActions: new Map(), lastSignature: null };
  }
}

function saveCache(
  completedHands: ParsedHandCompleted[],
  handActions: Map<string, HandActionData>,
  lastSignature: string | null,
): void {
  try {
    const cache: StatsCache = {
      version: CACHE_VERSION,
      programId: PROGRAM_ID.toString(),
      lastSignature,
      completedHands,
      handActions: Array.from(handActions.entries()).map(([key, val]) => [
        key,
        { seatMap: Array.from(val.seatMap.entries()), actions: val.actions },
      ]),
    };
    localStorage.setItem(getCacheKey(), JSON.stringify(cache));
  } catch {
    // localStorage might be full — silently fail
  }
}

// ─── Transaction fetching ───

const BATCH_SIZE = 20;

async function fetchAllEvents(
  connection: Connection,
  lastKnownSignature: string | null,
  onProgress?: (fetched: number, total: number) => void,
): Promise<{ events: ParsedEvent[]; newestSignature: string | null }> {
  const events: ParsedEvent[] = [];
  let newestSignature: string | null = null;

  // Fetch signatures in pages, going backwards from newest
  let beforeSig: string | undefined = undefined;
  let allSignatures: string[] = [];
  let page = 0;

  while (true) {
    const opts: { limit: number; before?: string; until?: string } = { limit: 1000 };
    if (beforeSig) opts.before = beforeSig;
    if (lastKnownSignature) opts.until = lastKnownSignature;

    const sigs = await connection.getSignaturesForAddress(PROGRAM_ID, opts);
    if (sigs.length === 0) break;

    allSignatures.push(...sigs.map(s => s.signature));
    beforeSig = sigs[sigs.length - 1].signature;
    page++;

    // Safety: cap at 5000 signatures per fetch cycle
    if (allSignatures.length >= 5000) break;
    // If we got fewer than 1000, we've reached the end
    if (sigs.length < 1000) break;
  }

  if (allSignatures.length === 0) return { events, newestSignature };

  newestSignature = allSignatures[0]; // Most recent

  // Process oldest first (reverse order)
  const sigList = allSignatures.reverse();

  for (let i = 0; i < sigList.length; i += BATCH_SIZE) {
    const batch = sigList.slice(i, i + BATCH_SIZE);
    onProgress?.(i, sigList.length);

    let txs: (any | null)[];
    try {
      txs = await connection.getParsedTransactions(batch, {
        maxSupportedTransactionVersion: 0,
      });
    } catch {
      continue; // Skip failed batches
    }

    for (let j = 0; j < txs.length; j++) {
      const tx = txs[j];
      if (!tx?.meta?.logMessages) continue;

      const dataLogs = tx.meta.logMessages.filter((log: string) => log.startsWith("Program data:"));
      for (const dataLog of dataLogs) {
        const event = parseEventFromLog(dataLog);
        if (event) events.push(event);
      }
    }
  }

  onProgress?.(sigList.length, sigList.length);
  return { events, newestSignature };
}

// ─── Period boundaries ───

function getPeriodBounds(period: TimePeriod): { start: number; end: number } | undefined {
  if (period === "all") return undefined;

  const now = new Date();
  const end = Math.floor(now.getTime() / 1000);

  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: Math.floor(start.getTime() / 1000), end };
  }

  // Week: Monday 00:00 UTC
  const dayOfWeek = now.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - daysSinceMonday);
  monday.setUTCHours(0, 0, 0, 0);
  return { start: Math.floor(monday.getTime() / 1000), end };
}

// ─── Hook ───

export function usePlayerStats() {
  const { connection } = useConnection();
  const [allStats, setAllStats] = useState<Map<string, PlayerStats>>(new Map());
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ fetched: number; total: number } | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);

  // Store raw event data for re-aggregation with time filters
  const completedHandsRef = useRef<ParsedHandCompleted[]>([]);
  const handActionsRef = useRef<Map<string, HandActionData>>(new Map());
  const lastSignatureRef = useRef<string | null>(null);
  const fetchingRef = useRef(false);

  const fetchStats = useCallback(async (forceRefresh = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);

    try {
      // Load cache
      if (!forceRefresh && completedHandsRef.current.length === 0) {
        const cached = loadCache();
        completedHandsRef.current = cached.completedHands;
        handActionsRef.current = cached.handActions;
        lastSignatureRef.current = cached.lastSignature;
      }

      if (forceRefresh) {
        completedHandsRef.current = [];
        handActionsRef.current = new Map();
        lastSignatureRef.current = null;
      }

      // Fetch new events
      const { events, newestSignature } = await fetchAllEvents(
        connection,
        lastSignatureRef.current,
        (fetched, total) => setProgress({ fetched, total }),
      );

      // Process events
      for (const event of events) {
        if (event.type === "HandCompleted") {
          const hk = handKey(event.tableId, event.handNumber);
          // Deduplicate
          if (!completedHandsRef.current.some(h => handKey(h.tableId, h.handNumber) === hk)) {
            completedHandsRef.current.push(event);

            // Build seat map from results for action matching
            const existing = handActionsRef.current.get(hk);
            const seatMap = new Map<number, string>();
            for (const r of event.results) seatMap.set(r.seatIndex, r.player);
            if (existing) {
              existing.seatMap = seatMap;
            } else {
              handActionsRef.current.set(hk, { seatMap, actions: [] });
            }
          }
        } else if (event.type === "ActionTaken") {
          const hk = handKey(event.tableId, event.handNumber);
          const existing = handActionsRef.current.get(hk);
          if (existing) {
            existing.actions.push(event);
          } else {
            handActionsRef.current.set(hk, { seatMap: new Map(), actions: [event] });
          }
        }
        // HandStarted: not needed for stats aggregation (info available in HandCompleted)
      }

      if (newestSignature) lastSignatureRef.current = newestSignature;

      // Save to cache
      saveCache(completedHandsRef.current, handActionsRef.current, lastSignatureRef.current);

      // Aggregate all-time stats
      const stats = aggregateStats(completedHandsRef.current, handActionsRef.current);
      setAllStats(stats);
      setLastFetch(Date.now());
    } catch (err) {
      console.error("[PlayerStats] Fetch error:", err);
    } finally {
      setLoading(false);
      setProgress(null);
      fetchingRef.current = false;
    }
  }, [connection]);

  // Get stats for a specific player
  const getPlayerStats = useCallback((wallet: string): PlayerStats | null => {
    return allStats.get(wallet) ?? null;
  }, [allStats]);

  // Get leaderboard for a time period
  const getLeaderboard = useCallback((period: TimePeriod, minHands = 10): LeaderboardEntry[] => {
    const bounds = getPeriodBounds(period);
    const stats = bounds
      ? aggregateStats(completedHandsRef.current, handActionsRef.current, bounds)
      : allStats;

    return Array.from(stats.values())
      .filter(s => s.handsPlayed >= minHands)
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .map((stats, i) => ({ wallet: stats.wallet, stats, rank: i + 1 }));
  }, [allStats]);

  // Get stats for a specific player with time filter
  const getPlayerStatsForPeriod = useCallback((wallet: string, period: TimePeriod): PlayerStats | null => {
    if (period === "all") return allStats.get(wallet) ?? null;

    const bounds = getPeriodBounds(period);
    if (!bounds) return allStats.get(wallet) ?? null;

    const stats = aggregateStats(completedHandsRef.current, handActionsRef.current, bounds);
    return stats.get(wallet) ?? null;
  }, [allStats]);

  // Total hands across all players (for display)
  const totalHandsTracked = completedHandsRef.current.length;
  const totalPlayersTracked = allStats.size;

  return {
    fetchStats,
    getPlayerStats,
    getPlayerStatsForPeriod,
    getLeaderboard,
    loading,
    progress,
    lastFetch,
    totalHandsTracked,
    totalPlayersTracked,
    allStats,
  };
}
