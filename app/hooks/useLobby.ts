"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { PublicKey } from "@solana/web3.js";
import { usePokerProgram } from "./usePokerProgram";
import { tableIdToString } from "@/lib/program";
import { mapTableStatus } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LobbyTable {
  publicKey: PublicKey;
  tableId: string;
  tableIdBytes: number[];
  authority: PublicKey;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  maxPlayers: number;
  currentPlayers: number;
  status: "Waiting" | "Playing" | "Closed";
  handNumber: number;
  occupiedSeats: number;
  rakeBps: number;
  rakeCap: number;
  lastReadyTime: number;
  tokenMint: string; // SPL token mint address
  tokenDecimals: number; // Token decimal places
}

export type LobbyFilter = "all" | "waiting" | "playing";
export type LobbySort = "players" | "stakes" | "newest" | "active";

export interface UseLobbyResult {
  tables: LobbyTable[];
  filteredTables: LobbyTable[];
  loading: boolean;
  error: string | null;
  filter: LobbyFilter;
  setFilter: (f: LobbyFilter) => void;
  sort: LobbySort;
  setSort: (s: LobbySort) => void;
  refresh: () => Promise<void>;
  tableCount: { all: number; waiting: number; playing: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 10_000;

/**
 * Count the number of set bits in a bitmap (population count).
 * Used to derive currentPlayers from the occupiedSeats bitmap.
 */
function popcount(n: number): number {
  let count = 0;
  let v = n;
  while (v) {
    count += v & 1;
    v >>>= 1;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useLobby(): UseLobbyResult {
  const { program } = usePokerProgram();

  const [tables, setTables] = useState<LobbyTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<LobbyFilter>("all");
  const [sort, setSort] = useState<LobbySort>("players");

  // Keep a ref to the latest program so the interval callback always sees it.
  const programRef = useRef(program);
  programRef.current = program;

  // ------------------------------------------------------------------
  // Fetch all Table accounts and map to LobbyTable[]
  // ------------------------------------------------------------------
  const fetchTables = useCallback(async () => {
    const prog = programRef.current;
    if (!prog) {
      setTables([]);
      setLoading(false);
      return;
    }

    try {
      // Anchor generates typed account accessors, but the generic `Program<Idl>`
      // type doesn't expose them directly. Cast through `any` to call `.all()`.
      const raw: { publicKey: PublicKey; account: any }[] =
        await (prog.account as any).table.all();

      const mapped: LobbyTable[] = raw
        .map(({ publicKey, account }) => {
          const status = mapTableStatus(account.status);

          // tableId comes back as a number[] from Anchor's [u8; 32]
          const tableIdBytes: number[] = account.tableId;
          const tableId = tableIdToString(new Uint8Array(tableIdBytes));

          const occupiedSeats =
            typeof account.occupiedSeats === "number"
              ? account.occupiedSeats
              : Number(account.occupiedSeats);

          return {
            publicKey,
            tableId,
            tableIdBytes,
            authority: account.authority as PublicKey,
            smallBlind: account.smallBlind.toNumber(),
            bigBlind: account.bigBlind.toNumber(),
            minBuyIn: account.minBuyIn.toNumber(),
            maxBuyIn: account.maxBuyIn.toNumber(),
            maxPlayers: account.maxPlayers,
            currentPlayers: popcount(occupiedSeats),
            status,
            handNumber: account.handNumber.toNumber(),
            occupiedSeats,
            rakeBps: account.rakeBps,
            rakeCap: account.rakeCap.toNumber(),
            lastReadyTime: account.lastReadyTime.toNumber(),
            tokenMint: account.tokenMint.toBase58(),
            tokenDecimals: account.tokenDecimals,
          } satisfies LobbyTable;
        })
        // Filter out closed tables and tables with non-printable names
        // (test artifacts from random keypair-based table IDs).
        .filter((t) => t.status !== "Closed")
        .filter((t) => t.tableId.length > 0 && /^[\x20-\x7E]+$/.test(t.tableId));

      setTables(mapped);
      setError(null);
    } catch (err) {
      console.error("[useLobby] Failed to fetch tables:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []); // programRef is a ref, no dependency needed

  // ------------------------------------------------------------------
  // Initial fetch + polling
  // ------------------------------------------------------------------
  useEffect(() => {
    // Reset loading state when program changes (e.g. wallet connect/disconnect)
    setLoading(true);
    fetchTables();

    const interval = setInterval(fetchTables, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchTables, program]);

  // ------------------------------------------------------------------
  // Derived: filter + sort
  // ------------------------------------------------------------------
  const filteredTables = useMemo(() => {
    // 1. Apply status filter
    let result = tables;
    if (filter === "waiting") {
      result = result.filter((t) => t.status === "Waiting");
    } else if (filter === "playing") {
      result = result.filter((t) => t.status === "Playing");
    }

    // 2. Apply sort
    result = [...result].sort((a, b) => {
      switch (sort) {
        case "players":
          return b.currentPlayers - a.currentPlayers;
        case "stakes":
          return b.bigBlind - a.bigBlind;
        case "newest":
          // Higher lastReadyTime = more recently created/active
          return b.lastReadyTime - a.lastReadyTime;
        case "active":
          return b.handNumber - a.handNumber;
        default:
          return 0;
      }
    });

    return result;
  }, [tables, filter, sort]);

  // ------------------------------------------------------------------
  // Derived: counts per status (for filter badges)
  // ------------------------------------------------------------------
  const tableCount = useMemo(() => {
    let waiting = 0;
    let playing = 0;
    for (const t of tables) {
      if (t.status === "Waiting") waiting++;
      else if (t.status === "Playing") playing++;
    }
    return { all: tables.length, waiting, playing };
  }, [tables]);

  // ------------------------------------------------------------------
  // Manual refresh (exposed to the UI for a refresh button, etc.)
  // ------------------------------------------------------------------
  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchTables();
  }, [fetchTables]);

  return {
    tables,
    filteredTables,
    loading,
    error,
    filter,
    setFilter,
    sort,
    setSort,
    refresh,
    tableCount,
  };
}
