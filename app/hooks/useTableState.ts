"use client";

/**
 * useTableState — Read-only hook for fetching on-chain poker table state.
 *
 * Designed for spectator mode: works WITHOUT a connected wallet by creating
 * a read-only Anchor provider. Returns sanitized game state where encrypted
 * hole card handles are NEVER exposed — spectators always see [null, null].
 *
 * PRIVACY INVARIANT: This hook must NEVER leak encrypted u128 card handles.
 * All player hole cards are returned as [null, null] unless the player is
 * the connected wallet AND cards are plaintext (0-51). Encrypted handles
 * (Inco FHE) are stripped at the data layer, not just the UI layer.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { PublicKey, Connection } from "@solana/web3.js";
import { Program, AnchorProvider, Idl } from "@coral-xyz/anchor";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { useWallet } from "@solana/wallet-adapter-react";
import idl from "@/lib/idl/hiddenhand.json";
import {
  getTablePDA,
  getSeatPDA,
  getHandPDA,
  getDeckPDA,
  generateTableId,
} from "@/lib/program";
import {
  mapPlayerStatus,
  mapGamePhase,
  mapTableStatus,
  getOccupiedSeats,
} from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpectatorPlayer {
  seatIndex: number;
  player: string;
  chips: number;
  currentBet: number;
  /** Always [null, null] for spectators. Only the connected player sees their own plaintext cards. */
  holeCards: [number | null, number | null];
  status: "empty" | "sitting" | "playing" | "folded" | "allin";
  isActive: boolean;
  isEncrypted: boolean;
  cardsRevealed: boolean;
  revealedCards: [number | null, number | null];
}

export interface TableState {
  tableId: string;
  tablePDA: PublicKey | null;
  // On-chain data
  authority: PublicKey | null;
  maxPlayers: number;
  currentPlayers: number;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  handNumber: number;
  rakeBps: number;
  rakeCap: number;
  tokenMint: PublicKey | null;
  tokenDecimals: number;
  // Game state
  phase: "Dealing" | "PreFlop" | "Flop" | "Turn" | "River" | "Showdown" | "Settled";
  tableStatus: "Waiting" | "Playing" | "Closed";
  pot: number;
  currentBet: number;
  communityCards: number[];
  dealerPosition: number;
  actionOn: number;
  players: SpectatorPlayer[];
  lastActionTime: number | null;
  lastReadyTime: number | null;
  // Deck state
  isDeckShuffled: boolean;
  // Spectator metadata
  isSpectating: boolean;
  isConnected: boolean;
  currentPlayerSeat: number | null;
  canJoin: boolean;
}

export interface UseTableStateResult {
  state: TableState;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 3_000;

// ---------------------------------------------------------------------------
// Dummy wallet for read-only Anchor provider (no signing capability)
// ---------------------------------------------------------------------------

const DUMMY_PUBKEY = new PublicKey("11111111111111111111111111111111");

const dummyWallet = {
  publicKey: DUMMY_PUBKEY,
  signTransaction: async <T,>(tx: T): Promise<T> => tx,
  signAllTransactions: async <T,>(txs: T[]): Promise<T[]> => txs,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const initialState: TableState = {
  tableId: "",
  tablePDA: null,
  authority: null,
  maxPlayers: 6,
  currentPlayers: 0,
  smallBlind: 0,
  bigBlind: 0,
  minBuyIn: 0,
  maxBuyIn: 0,
  handNumber: 0,
  rakeBps: 0,
  rakeCap: 0,
  tokenMint: null,
  tokenDecimals: 6,
  phase: "Settled",
  tableStatus: "Waiting",
  pot: 0,
  currentBet: 0,
  communityCards: [],
  dealerPosition: 0,
  actionOn: 0,
  players: [],
  lastActionTime: null,
  lastReadyTime: null,
  isDeckShuffled: false,
  isSpectating: true,
  isConnected: false,
  currentPlayerSeat: null,
  canJoin: false,
};

export function useTableState(tableId: string): UseTableStateResult {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { connected, publicKey } = useWallet();

  const [state, setState] = useState<TableState>({ ...initialState, tableId });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Derive table PDA from ID
  const tablePDA = useMemo(() => {
    if (!tableId) return null;
    const tableIdBytes = generateTableId(tableId);
    const [pda] = getTablePDA(tableIdBytes);
    return pda;
  }, [tableId]);

  // Create read-only Anchor program (works without wallet)
  const program = useMemo(() => {
    const provider = new AnchorProvider(
      connection,
      wallet ?? dummyWallet,
      { commitment: "confirmed", preflightCommitment: "confirmed" }
    );
    return new Program(idl as Idl, provider);
  }, [connection, wallet]);

  // Fetch all player seats for a table
  const fetchPlayerSeats = useCallback(
    async (
      tblPDA: PublicKey,
      maxPlayers: number,
      occupiedSeats: number,
    ): Promise<SpectatorPlayer[]> => {
      const players: SpectatorPlayer[] = [];
      const occupied = getOccupiedSeats(occupiedSeats, maxPlayers);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accounts = program.account as any;

      for (let i = 0; i < maxPlayers; i++) {
        if (occupied.includes(i)) {
          try {
            const [seatPDA] = getSeatPDA(tblPDA, i);
            const seat = await accounts.playerSeat.fetch(seatPDA);

            const isCurrentPlayer = publicKey?.equals(seat.player) ?? false;

            // PRIVACY: Check if cards are encrypted or plaintext
            const holeCard1BigInt = BigInt(seat.holeCard1.toString());
            const holeCard2BigInt = BigInt(seat.holeCard2.toString());
            const isCard1Encrypted = holeCard1BigInt > BigInt(255);
            const isCard2Encrypted = holeCard2BigInt > BigInt(255);
            const areCardsEncrypted = isCard1Encrypted || isCard2Encrypted;
            const hasDealtCards =
              holeCard1BigInt !== BigInt(255) && holeCard2BigInt !== BigInt(255);

            // PRIVACY INVARIANT: Only the connected player sees their own
            // plaintext cards. Everyone else gets [null, null]. NEVER expose
            // encrypted u128 handles.
            let holeCards: [number | null, number | null] = [null, null];
            if (isCurrentPlayer && !areCardsEncrypted && hasDealtCards) {
              const c1 = Number(holeCard1BigInt);
              const c2 = Number(holeCard2BigInt);
              if (c1 >= 0 && c1 <= 51 && c2 >= 0 && c2 <= 51) {
                holeCards = [c1, c2];
              }
            }

            // Revealed cards at showdown — these are public, safe to show
            const revealedCard1 = seat.revealedCard1;
            const revealedCard2 = seat.revealedCard2;
            const hasRevealedCards =
              seat.cardsRevealed &&
              revealedCard1 !== 255 &&
              revealedCard2 !== 255 &&
              revealedCard1 >= 0 &&
              revealedCard1 <= 51 &&
              revealedCard2 >= 0 &&
              revealedCard2 <= 51;

            players.push({
              seatIndex: seat.seatIndex,
              player: seat.player.toString(),
              chips: seat.chips.toNumber(),
              currentBet: seat.totalBetThisHand.toNumber(),
              holeCards,
              status: mapPlayerStatus(seat.status),
              isActive: hasDealtCards,
              isEncrypted: areCardsEncrypted,
              cardsRevealed: seat.cardsRevealed ?? false,
              revealedCards: hasRevealedCards
                ? [revealedCard1, revealedCard2]
                : [null, null],
            });
          } catch {
            players.push(emptyPlayer(i));
          }
        } else {
          players.push(emptyPlayer(i));
        }
      }

      return players;
    },
    [program, publicKey],
  );

  // Main refresh function
  const refreshState = useCallback(async () => {
    if (!tablePDA) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accounts = program.account as any;

    try {
      // Fetch table account
      let table;
      try {
        table = await accounts.table.fetch(tablePDA);
      } catch {
        // Table doesn't exist
        setState((prev) => ({
          ...prev,
          tableStatus: "Closed" as const,
          error: "Table not found",
        }));
        setLoading(false);
        return;
      }

      const tableStatus = mapTableStatus(table.status);
      const handNumber = table.handNumber.toNumber();

      // Fetch players
      const players = await fetchPlayerSeats(
        tablePDA,
        table.maxPlayers,
        typeof table.occupiedSeats === "number"
          ? table.occupiedSeats
          : Number(table.occupiedSeats),
      );

      // Fetch hand state if playing
      let handState = null;
      let deckState = null;
      if (tableStatus === "Playing" && handNumber > 0) {
        try {
          const [handPDA] = getHandPDA(tablePDA, BigInt(handNumber));
          handState = await accounts.handState.fetch(handPDA);

          const [deckPDA] = getDeckPDA(tablePDA, BigInt(handNumber));
          try {
            deckState = await accounts.deckState.fetch(deckPDA);
          } catch {
            // Deck state might not exist yet
          }
        } catch {
          // Hand doesn't exist yet
        }
      }

      const phase = handState ? mapGamePhase(handState.phase) : "Settled";

      // Parse community cards
      let communityCards: number[] = [];
      if (handState?.communityCards) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = handState.communityCards as any;
        if (Array.isArray(raw)) {
          communityCards = raw.map((c: unknown) =>
            typeof c === "number" ? c : Number(c),
          );
        } else if (raw instanceof Uint8Array || Buffer.isBuffer(raw)) {
          communityCards = Array.from(raw);
        }
      }

      // Determine spectator status
      const currentPlayerSeat =
        players.find((p) => p.player === publicKey?.toString())?.seatIndex ??
        null;
      const isSpectating = currentPlayerSeat === null;
      const hasOpenSeats = players.some((p) => p.status === "empty");
      const canJoin =
        connected && isSpectating && hasOpenSeats && tableStatus !== "Closed";

      setState({
        tableId,
        tablePDA,
        authority: table.authority,
        maxPlayers: table.maxPlayers,
        currentPlayers: players.filter((p) => p.status !== "empty").length,
        smallBlind: table.smallBlind.toNumber(),
        bigBlind: table.bigBlind.toNumber(),
        minBuyIn: table.minBuyIn.toNumber(),
        maxBuyIn: table.maxBuyIn.toNumber(),
        handNumber,
        rakeBps: table.rakeBps,
        rakeCap: table.rakeCap.toNumber(),
        tokenMint: table.tokenMint ?? null,
        tokenDecimals: table.tokenDecimals ?? 6,
        phase,
        tableStatus,
        pot: handState?.pot.toNumber() ?? 0,
        currentBet: handState?.currentBet.toNumber() ?? 0,
        communityCards,
        dealerPosition: handState?.dealerPosition ?? table.dealerPosition,
        actionOn: handState?.actionOn ?? 0,
        players,
        lastActionTime: handState?.lastActionTime?.toNumber() ?? null,
        lastReadyTime: table.lastReadyTime?.toNumber() ?? null,
        isDeckShuffled: deckState?.isShuffled ?? false,
        isSpectating,
        isConnected: connected,
        currentPlayerSeat,
        canJoin,
      });

      setError(null);
    } catch (e) {
      console.error("[useTableState] Refresh error:", e);
      setError(e instanceof Error ? e.message : "Failed to fetch table state");
    } finally {
      setLoading(false);
    }
  }, [
    tablePDA,
    program,
    fetchPlayerSeats,
    tableId,
    connected,
    publicKey,
  ]);

  // Polling
  useEffect(() => {
    if (!tablePDA) return;

    setLoading(true);
    refreshState();

    pollingRef.current = setInterval(refreshState, POLL_INTERVAL_MS);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [tablePDA, refreshState]);

  return { state, loading, error, refresh: refreshState };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyPlayer(seatIndex: number): SpectatorPlayer {
  return {
    seatIndex,
    player: "",
    chips: 0,
    currentBet: 0,
    holeCards: [null, null],
    status: "empty",
    isActive: false,
    isEncrypted: false,
    cardsRevealed: false,
    revealedCards: [null, null],
  };
}
