"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Idl } from "@coral-xyz/anchor";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import idl from "@/lib/idl/hiddenhand.json";
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
export type StakeTier = "all" | "micro" | "low" | "mid" | "high";
export type TableSize = "all" | "headsup" | "6max";

export interface UseLobbyResult {
  tables: LobbyTable[];
  filteredTables: LobbyTable[];
  loading: boolean;
  error: string | null;
  filter: LobbyFilter;
  setFilter: (f: LobbyFilter) => void;
  sort: LobbySort;
  setSort: (s: LobbySort) => void;
  stakeTier: StakeTier;
  setStakeTier: (s: StakeTier) => void;
  tableSize: TableSize;
  setTableSize: (s: TableSize) => void;
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

// Dummy wallet for read-only Anchor provider (no signing capability)
const DUMMY_PUBKEY = new PublicKey("11111111111111111111111111111111");
const dummyWallet = {
  publicKey: DUMMY_PUBKEY,
  signTransaction: async <T,>(tx: T): Promise<T> => tx,
  signAllTransactions: async <T,>(txs: T[]): Promise<T[]> => txs,
};

export function useLobby(): UseLobbyResult {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  // Read-only Anchor program — works with or without a connected wallet
  const program = useMemo(() => {
    const provider = new AnchorProvider(
      connection,
      wallet ?? dummyWallet,
      { commitment: "confirmed", preflightCommitment: "confirmed" },
    );
    return new Program(idl as Idl, provider);
  }, [connection, wallet]);

  const [tables, setTables] = useState<LobbyTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<LobbyFilter>("all");
  const [sort, setSort] = useState<LobbySort>("players");
  const [stakeTier, setStakeTier] = useState<StakeTier>("all");
  const [tableSize, setTableSize] = useState<TableSize>("all");

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
      // Filter by dataSize to skip old table accounts created before the USDC
      // migration added token_mint (32B) and token_decimals (1B) fields.
      // Current Table account size = 177 bytes (from Table::SIZE in table.rs).
      const TABLE_ACCOUNT_SIZE = 177;
      const raw: { publicKey: PublicKey; account: any }[] =
        await (prog.account as any).table.all([
          { dataSize: TABLE_ACCOUNT_SIZE },
        ]);

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

    // 2. Apply stake tier filter (based on big blind in base units)
    // Thresholds use the table's token decimals for comparison
    if (stakeTier !== "all") {
      result = result.filter((t) => {
        // Normalize to "display units" for tier comparison
        const factor = Math.pow(10, t.tokenDecimals || 6);
        const bbDisplay = t.bigBlind / factor;
        switch (stakeTier) {
          case "micro": return bbDisplay < 0.05;
          case "low":   return bbDisplay >= 0.05 && bbDisplay < 0.5;
          case "mid":   return bbDisplay >= 0.5 && bbDisplay < 5;
          case "high":  return bbDisplay >= 5;
          default:      return true;
        }
      });
    }

    // 3. Apply table size filter
    if (tableSize !== "all") {
      result = result.filter((t) => {
        if (tableSize === "headsup") return t.maxPlayers === 2;
        if (tableSize === "6max") return t.maxPlayers >= 3;
        return true;
      });
    }

    // 4. Apply sort
    result = [...result].sort((a, b) => {
      switch (sort) {
        case "players":
          return b.currentPlayers - a.currentPlayers;
        case "stakes":
          return b.bigBlind - a.bigBlind;
        case "newest":
          return b.lastReadyTime - a.lastReadyTime;
        case "active":
          return b.handNumber - a.handNumber;
        default:
          return 0;
      }
    });

    return result;
  }, [tables, filter, sort, stakeTier, tableSize]);

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
    stakeTier,
    setStakeTier,
    tableSize,
    setTableSize,
    refresh,
    tableCount,
  };
}
