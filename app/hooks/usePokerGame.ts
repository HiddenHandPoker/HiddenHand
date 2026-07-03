"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { BN } from "@anchor-lang/core";
import { usePokerProgram } from "./usePokerProgram";
import {
  PROGRAM_ID,
  getTablePDA,
  getSeatPDA,
  getHandPDA,
  getDeckPDA,
  getVaultPDA,
  generateTableId,
} from "@/lib/program";
import {
  mapPlayerStatus,
  mapGamePhase,
  mapTableStatus,
  getOccupiedSeats,
  parseAnchorError,
} from "@/lib/utils";
import {
  deriveEncryptionKeys,
  fetchMXEPublicKey,
  decryptHoleCards,
  queueAccounts,
  awaitFinalization,
  scanRecentEvents,
  newComputationOffset,
  newNonce,
  isRealCard,
  type EncryptionKeys,
} from "@/lib/arcium";
import { TransactionInstruction, Transaction, Keypair } from "@solana/web3.js";
import { getDefaultToken, getTokenByMint, TOKEN_PROGRAM_ID, type TokenInfo } from "@/lib/tokens";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  getSessionTokenPDA,
  buildCreateSessionInstruction,
  SESSION_DURATION_SECONDS,
  saveSession,
} from "./useSessionKey";

// Types matching the IDL
export interface TableAccount {
  authority: PublicKey;
  tableId: number[];
  smallBlind: BN;
  bigBlind: BN;
  minBuyIn: BN;
  maxBuyIn: BN;
  maxPlayers: number;
  currentPlayers: number;
  status: { waiting?: object; playing?: object; closed?: object };
  handNumber: BN;
  occupiedSeats: number;
  dealerPosition: number;
  lastReadyTime: BN; // Unix timestamp for start_hand timeout
  rakeBps: number;
  rakeCap: BN;
  accumulatedRake: BN;
  tokenMint: PublicKey; // SPL token mint for this table
  tokenDecimals: number; // Cached token decimals (e.g. 6 for USDC)
  bump: number;
}

export interface HandStateAccount {
  table: PublicKey;
  handNumber: BN;
  phase: { dealing?: object; preFlop?: object; flop?: object; turn?: object; river?: object; showdown?: object; settled?: object };
  pot: BN;
  currentBet: BN;
  minRaise: BN;
  dealerPosition: number;
  actionOn: number;
  communityCards: number[];
  communityRevealed: number;
  activePlayers: number;
  actedThisRound: number;
  activeCount: number;
  allInPlayers: number; // Bitmap of players who are all-in
  lastActionTime: BN;  // Unix timestamp (seconds)
  handStartTime: BN;   // Unix timestamp (seconds)
  awaitingCommunityReveal: boolean; // Whether waiting for community card reveal
  dealtPlayers: number; // Bitmap of seats that have run deal_to_seat this hand
  bump: number;
}

export interface PlayerSeatAccount {
  table: PublicKey;
  player: PublicKey;
  seatIndex: number;
  chips: BN;
  currentBet: BN;
  totalBetThisHand: BN;
  // Hole cards are NO LONGER stored on-chain (Arcium MPC): they live only
  // client-side (decrypted from the HoleDealt event) until showdown.
  revealedCard1: number;  // Revealed plaintext card (0-51 or 255)
  revealedCard2: number;  // Revealed plaintext card (0-51 or 255)
  cardsRevealed: boolean; // Whether player has revealed cards for showdown
  status: { sitting?: object; playing?: object; folded?: object; allIn?: object };
  hasActed: boolean;
  bump: number;
}

export interface DeckStateAccount {
  // Arcium MPC deck: the whole 52-card deck sealed to the MXE as opaque
  // ciphertext (2 field elements). Re-fed into every later circuit.
  deck: number[][];
  deckNonce: BN;
  hand: PublicKey;
  handNumber: BN;
  isShuffled: boolean;
  bump: number;
}

// UI-friendly types
export interface Player {
  seatIndex: number;
  player: string;
  chips: number;
  currentBet: number;
  holeCards: [number | null, number | null];
  status: "empty" | "sitting" | "playing" | "folded" | "allin";
  isActive: boolean;
  isDelegated?: boolean; // Whether seat is delegated to ER
  isEncrypted?: boolean; // Whether hole cards are Inco-encrypted
  cardsRevealed?: boolean; // Whether cards have been revealed for showdown
  revealedCards?: [number | null, number | null]; // Plaintext cards after reveal (0-51)
}

export interface GameState {
  tableId: string;
  tablePDA: PublicKey | null;
  table: TableAccount | null;
  handState: HandStateAccount | null;
  deckState: DeckStateAccount | null;
  players: Player[];
  phase: "Dealing" | "PreFlop" | "Flop" | "Turn" | "River" | "Showdown" | "Settled";
  tableStatus: "Waiting" | "Playing" | "Closed";
  pot: number;
  currentBet: number;
  minRaise: number;
  communityCards: number[];
  dealerPosition: number;
  actionOn: number;
  smallBlind: number;
  bigBlind: number;
  isAuthority: boolean;
  currentPlayerSeat: number | null;
  lastActionTime: number | null; // Unix timestamp for timeout tracking
  lastReadyTime: number | null; // Unix timestamp for start_hand timeout
  // MagicBlock state
  useVrf: boolean; // Whether to use VRF for shuffling
  isShuffling: boolean; // VRF shuffle in progress
  isDeckShuffled: boolean; // VRF shuffle complete
  // Inco TEE privacy state
  useIncoPrivacy: boolean; // Whether to use Inco TEE encryption for cards
  isEncrypting: boolean; // Inco encryption in progress
  areCardsEncrypted: boolean; // Whether current cards are Inco-encrypted
  areAllowancesGranted: boolean; // Whether current player's decryption allowances have been granted
  allPlayersHaveAllowances: boolean; // Whether ALL active players have allowances (for Grant button)
  isDecrypting: boolean; // Inco decryption in progress
  decryptedCards: [number | null, number | null]; // Client-side decrypted cards
  isRevealing: boolean; // Card reveal in progress (for showdown)
  encryptionHandNumber: number | null; // Hand number when encryption was detected (prevents cross-hand leakage)
  // Ed25519 attestation for card reveal verification
  ed25519Instructions: TransactionInstruction[]; // Stored from decryption for reveal verification
  // Community card reveal state (privacy feature)
  awaitingCommunityReveal: boolean; // Whether waiting for authority to reveal community cards
  isRevealingCommunity: boolean; // Community card reveal in progress
}

export interface UsePokerGameResult {
  // State
  gameState: GameState;
  loading: boolean;
  error: string | null;

  // Actions
  createTable: (config: CreateTableConfig) => Promise<string>;
  joinTable: (seatIndex: number, buyInSol: number) => Promise<string>;
  leaveTable: () => Promise<string>;
  startHand: () => Promise<string>;
  dealCards: () => Promise<string>;
  playerAction: (action: ActionType) => Promise<string>;
  showdown: () => Promise<string>;
  timeoutPlayer: () => Promise<string>;

  // MagicBlock VRF Actions
  requestShuffle: () => Promise<string>;

  // Inco TEE Encryption Actions
  encryptHoleCards: (seatIndex: number) => Promise<string>; // Phase 1: Encrypt cards
  grantCardAllowance: (seatIndex: number) => Promise<string>; // Phase 2: Grant decryption
  revealCards: () => Promise<string>; // Reveal decrypted cards for showdown
  encryptAndGrantCards: (seatIndex: number) => Promise<void>; // Combined helper
  encryptAllPlayersCards: () => Promise<void>; // Encrypt all players' cards
  grantAllPlayersAllowances: () => Promise<void>; // Grant allowances only (for atomic encryption)
  decryptMyCards: () => Promise<void>; // Client-side decrypt own cards

  // Game Liveness Actions (prevent stuck games)
  grantOwnAllowance: () => Promise<string>; // Self-grant allowance after 60s timeout
  timeoutReveal: (targetSeat: number) => Promise<string>; // Muck non-revealing player after 3 min
  closeInactiveTable: () => Promise<string>; // Close inactive table after 1 hour, return funds

  // Community card reveal (privacy feature - authority only)
  revealCommunityCards: () => Promise<string>; // Reveal encrypted community cards with Ed25519 verification

  // Utilities
  refreshState: () => Promise<void>;
  setTableId: (tableId: string) => void;
  setUseVrf: (useVrf: boolean) => void;
  setUseIncoPrivacy: (useInco: boolean) => void;

  // Program instance (for event listeners)
  program: ReturnType<typeof usePokerProgram>["program"];
}

export interface CreateTableConfig {
  tableId: string;
  smallBlind: number; // in token base units
  bigBlind: number; // in token base units
  minBuyIn: number; // in token base units
  maxBuyIn: number; // in token base units
  maxPlayers: number;
  rakeBps?: number; // rake in basis points (0 = no rake, max 1000 = 10%)
  rakeCap?: number; // max rake per hand in token base units (0 = no cap)
  tokenMint?: string; // SPL token mint address (default: USDC)
}

export type ActionType =
  | { type: "fold" }
  | { type: "check" }
  | { type: "call" }
  | { type: "raise"; amount: number }
  | { type: "allIn" };

const initialGameState: GameState = {
  tableId: "",
  tablePDA: null,
  table: null,
  handState: null,
  deckState: null,
  players: [],
  phase: "Settled",
  tableStatus: "Waiting",
  pot: 0,
  currentBet: 0,
  minRaise: 0,
  communityCards: [],
  dealerPosition: 0,
  actionOn: 0,
  smallBlind: 0,
  bigBlind: 0,
  isAuthority: false,
  currentPlayerSeat: null,
  lastActionTime: null,
  lastReadyTime: null,
  // MagicBlock state
  useVrf: true, // VRF oracle is working - use provably fair shuffling
  isShuffling: false,
  isDeckShuffled: false,
  // Inco TEE privacy state
  useIncoPrivacy: true, // Default to Inco privacy ON (cryptographic card encryption)
  isEncrypting: false,
  areCardsEncrypted: false,
  areAllowancesGranted: false,
  allPlayersHaveAllowances: false,
  isDecrypting: false,
  decryptedCards: [null, null],
  isRevealing: false,
  encryptionHandNumber: null, // Track which hand encryption belongs to
  ed25519Instructions: [], // Ed25519 verification instructions for card reveal
  // Community card reveal state
  awaitingCommunityReveal: false,
  isRevealingCommunity: false,
};

export interface SessionKeyParam {
  /** The session ephemeral key's public key (used as tx signer) */
  signerPublicKey: PublicKey;
  /** The session token PDA to pass as an account */
  sessionTokenPDA: PublicKey;
  /** Send a transaction signed by the session key (no wallet popup) */
  sendWithSession: (tx: Transaction) => Promise<string>;
  /** Activate a session created externally (e.g., bundled with joinTable) */
  activateSession: (keypair: Keypair, sessionTokenPDA: PublicKey, validUntil: number) => void;
  /** Whether the session is currently valid */
  isActive: boolean;
}

// ── Hole-card refresh recovery ──────────────────────────────────────────────
// A player's decrypted hole cards live ONLY client-side (from the one-time
// HoleDealt event). A page refresh would lose them, and the on-chain "dealt"
// bit blocks re-dealing — so cache them in sessionStorage (same browser, the
// player's own cards) keyed by table+hand+seat, and restore on load.
function holeCardsKey(tablePda: PublicKey, handNumber: number, seat: number): string {
  return `hh_holecards:${tablePda.toBase58()}:${handNumber}:${seat}`;
}
function saveHoleCards(tablePda: PublicKey, handNumber: number, seat: number, cards: [number, number]): void {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.setItem(holeCardsKey(tablePda, handNumber, seat), JSON.stringify(cards)); } catch {}
}
function loadHoleCards(tablePda: PublicKey, handNumber: number, seat: number): [number, number] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(holeCardsKey(tablePda, handNumber, seat));
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (Array.isArray(c) && c.length === 2 && typeof c[0] === "number" && typeof c[1] === "number") {
      return [c[0], c[1]];
    }
  } catch {}
  return null;
}

export function usePokerGame(sessionKey?: SessionKeyParam | null): UsePokerGameResult {
  const { program, provider, publicKey, signMessage } = usePokerProgram();
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  // Ref to track encryptionHandNumber for stale closure prevention in refreshState
  const encryptionHandNumberRef = useRef<number | null>(null);
  // Ref to prevent duplicate community reveal attempts (race condition prevention)
  const communityRevealInProgressRef = useRef<boolean>(false);
  // Arcium: cached MXE x25519 public key + this wallet's derived encryption keys.
  const mxePublicKeyRef = useRef<Uint8Array | null>(null);
  const encKeysRef = useRef<EncryptionKeys | null>(null);
  // Guard so we fire the batched showdown reveal at most once.
  const showdownRevealInProgressRef = useRef<boolean>(false);

  // Keep the ref in sync with gameState.encryptionHandNumber
  useEffect(() => {
    encryptionHandNumberRef.current = gameState.encryptionHandNumber;
  }, [gameState.encryptionHandNumber]);

  // Toggle VRF mode
  const setUseVrf = useCallback((useVrf: boolean) => {
    setGameState((prev) => ({ ...prev, useVrf }));
  }, []);

  // Toggle Inco TEE Privacy mode (cryptographic card encryption)
  const setUseIncoPrivacy = useCallback((useIncoPrivacy: boolean) => {
    setGameState((prev) => ({ ...prev, useIncoPrivacy }));
  }, []);

  // Set table ID and derive PDA
  const setTableId = useCallback((tableId: string) => {
    if (!tableId) {
      setGameState(initialGameState);
      return;
    }
    const tableIdBytes = generateTableId(tableId);
    const [tablePDA] = getTablePDA(tableIdBytes);
    setGameState((prev) => ({
      ...prev,
      tableId,
      tablePDA,
    }));
  }, []);

  // Fetch all player seats for a table
  const fetchPlayerSeats = useCallback(
    async (tablePDA: PublicKey, maxPlayers: number, occupiedSeats: number): Promise<Player[]> => {
      if (!program) return [];

      const players: Player[] = [];
      const occupied = getOccupiedSeats(occupiedSeats, maxPlayers);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accounts = program.account as any;

      for (let i = 0; i < maxPlayers; i++) {
        if (occupied.includes(i)) {
          try {
            const [seatPDA] = getSeatPDA(tablePDA, i);
            const seat = await accounts.playerSeat.fetch(seatPDA) as PlayerSeatAccount;

            // Arcium MPC: hole cards are NEVER on-chain. On-chain we only know a
            // seat's status (in the hand or not) and — after showdown — its
            // revealed plaintext cards. A player's own live hole cards are
            // decrypted client-side from the HoleDealt event and substituted by
            // the UI from gameState.decryptedCards.
            const status = mapPlayerStatus(seat.status);
            // "In the hand" this deal: dealt-in players are Playing/Folded/AllIn.
            const inHand = status !== "sitting";

            // Revealed cards (written on-chain by the showdown_reveal callback).
            const revealedCard1 = seat.revealedCard1;
            const revealedCard2 = seat.revealedCard2;
            const hasRevealedCards = seat.cardsRevealed &&
                                     isRealCard(revealedCard1) && isRealCard(revealedCard2);

            players.push({
              seatIndex: seat.seatIndex,
              player: seat.player.toString(),
              chips: seat.chips.toNumber(),
              currentBet: seat.totalBetThisHand.toNumber(), // Use total bet this hand, not per-round
              // Others' hole cards are never visible; the local player's decrypted
              // cards are merged in by the table page from gameState.decryptedCards.
              holeCards: [null, null],
              status,
              isActive: inHand,
              // Show the sealed/face-down "encrypted" state while a live hand is
              // in progress and cards have not been revealed at showdown.
              isEncrypted: inHand && !hasRevealedCards,
              cardsRevealed: seat.cardsRevealed ?? false,
              // Revealed cards for showdown display (visible to all players)
              revealedCards: hasRevealedCards ? [revealedCard1, revealedCard2] : [null, null],
            });
          } catch (e) {
            // Seat PDA doesn't exist yet
            players.push({
              seatIndex: i,
              player: "",
              chips: 0,
              currentBet: 0,
              holeCards: [null, null],
              status: "empty",
              isActive: false,
              isEncrypted: false,
              cardsRevealed: false,
              revealedCards: [null, null],
            });
          }
        } else {
          players.push({
            seatIndex: i,
            player: "",
            chips: 0,
            currentBet: 0,
            holeCards: [null, null],
            status: "empty",
            isActive: false,
            isEncrypted: false,
            cardsRevealed: false,
            revealedCards: [null, null],
          });
        }
      }

      return players;
    },
    [program, publicKey]
  );

  // Refresh all game state from the base layer
  const refreshState = useCallback(async () => {
    if (!program || !provider || !gameState.tablePDA) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accounts = program.account as any;

    // First, fetch table to get hand number
    let table: TableAccount;
    try {
      table = await accounts.table.fetch(gameState.tablePDA) as TableAccount;
    } catch (e) {
      setGameState((prev) => ({
        ...prev,
        table: null,
        tableStatus: "Waiting",
      }));
      return;
    }

    const tableStatus = mapTableStatus(table.status);

    try {
      const isAuthority = publicKey?.equals(table.authority) ?? false;

      // Fetch player seats
      const players = await fetchPlayerSeats(
        gameState.tablePDA,
        table.maxPlayers,
        table.occupiedSeats
      );

      // Find current player's seat
      const currentPlayerSeat = players.find(
        (p) => p.player === publicKey?.toString()
      )?.seatIndex ?? null;

      // Fetch hand state if playing
      let handState: HandStateAccount | null = null;
      let deckState: DeckStateAccount | null = null;
      if (tableStatus === "Playing" && table.handNumber.toNumber() > 0) {
        try {
          const [handPDA] = getHandPDA(gameState.tablePDA, BigInt(table.handNumber.toNumber()));
          handState = await accounts.handState.fetch(handPDA) as HandStateAccount;

          // Also fetch deck state for VRF status
          const [deckPDA] = getDeckPDA(gameState.tablePDA, BigInt(table.handNumber.toNumber()));
          try {
            deckState = await accounts.deckState.fetch(deckPDA) as DeckStateAccount;
          } catch (e) {
            // Deck state might not exist yet
          }
        } catch (e) {
          // Hand doesn't exist yet
        }
      }

      const phase = handState ? mapGamePhase(handState.phase) : "Settled";
      // Convert community cards to plain numbers
      // They come from on-chain as Vec<u8>, which Anchor might deserialize as Buffer/Uint8Array or number[]
      let communityCards: number[] = [];
      if (handState?.communityCards) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = handState.communityCards as any;
        if (Array.isArray(raw)) {
          communityCards = raw.map((c: unknown) => typeof c === 'number' ? c : Number(c));
        } else if (raw instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(raw))) {
          communityCards = Array.from(raw);
        } else if (raw && typeof raw[Symbol.iterator] === 'function') {
          // Fallback: try to iterate
          communityCards = Array.from(raw);
        }
      }

      // Get current hand number for tracking encryption state across hands
      const currentHandNumber = table.handNumber.toNumber();

      // Reset per-hand card state when the table is idle between hands, or when
      // the hand number changed (prevents cross-hand leakage of decrypted cards).
      // NOTE: we do NOT reset merely because phase === "Dealing" — under Arcium
      // each player deals + decrypts their own cards DURING the Dealing phase.
      // NOTE: Uses ref to avoid stale closure - refreshState dependencies don't include encryptionHandNumber
      const isNewHand = encryptionHandNumberRef.current !== null &&
                        currentHandNumber !== encryptionHandNumberRef.current;
      const resetEncryptionState = tableStatus === "Waiting" || isNewHand;

      // Arcium MPC has no per-card allowances: the deck is "sealed" (cards
      // encrypted) the moment the MPC shuffle callback runs, and each player
      // decrypts their own hole cards straight from the HoleDealt event — there
      // is nothing to grant. We keep the legacy flag names (areCardsEncrypted /
      // areAllowancesGranted / allPlayersHaveAllowances) so the table-page UI
      // keeps working; here they all collapse to "is the deck sealed yet".
      const deckSealed = deckState?.isShuffled ?? false;
      const detectedCardsEncrypted = deckSealed;
      const detectedAllowancesGranted = deckSealed;
      const detectedAllPlayersHaveAllowances = deckSealed;

      // Refresh recovery: if we've already dealt in this hand (on-chain "dealt"
      // bit set) but have no cards in memory (e.g. after a page reload), restore
      // them from the sessionStorage cache written at deal time.
      let restoredCards: [number | null, number | null] | null = null;
      if (!resetEncryptionState && currentPlayerSeat !== null && handState &&
          (handState.dealtPlayers & (1 << currentPlayerSeat)) !== 0) {
        restoredCards = loadHoleCards(gameState.tablePDA, currentHandNumber, currentPlayerSeat);
      }

      setGameState((prev) => ({
        ...prev,
        table,
        handState,
        deckState,
        players,
        phase,
        tableStatus,
        pot: handState?.pot.toNumber() ?? 0,
        currentBet: handState?.currentBet.toNumber() ?? 0,
        minRaise: handState?.minRaise.toNumber() ?? table.bigBlind.toNumber(),
        communityCards,
        dealerPosition: handState?.dealerPosition ?? table.dealerPosition,
        actionOn: handState?.actionOn ?? 0,
        smallBlind: table.smallBlind.toNumber(),
        bigBlind: table.bigBlind.toNumber(),
        isAuthority,
        currentPlayerSeat,
        lastActionTime: handState?.lastActionTime?.toNumber() ?? null,
        lastReadyTime: table.lastReadyTime?.toNumber() ?? null,
        // isShuffled means VRF callback completed atomic shuffle + encrypt
        isDeckShuffled: deckState?.isShuffled ?? false,
        // Reset Inco encryption state for new hands or when hand number changes
        areCardsEncrypted: resetEncryptionState ? false : (detectedCardsEncrypted || prev.areCardsEncrypted),
        // Allowances: prefer on-chain detection, but preserve local state to avoid race conditions
        // Only preserve local state if we're in the same hand (detectedCardsEncrypted implies same hand)
        areAllowancesGranted: resetEncryptionState ? false : (detectedAllowancesGranted || (detectedCardsEncrypted && prev.areAllowancesGranted)),
        // All players have allowances: for Grant Allowances button visibility (authority needs this)
        allPlayersHaveAllowances: resetEncryptionState ? false : (detectedAllPlayersHaveAllowances || (detectedCardsEncrypted && prev.allPlayersHaveAllowances)),
        isEncrypting: resetEncryptionState ? false : prev.isEncrypting,
        isDecrypting: resetEncryptionState ? false : prev.isDecrypting,
        decryptedCards: resetEncryptionState
          ? [null, null]
          : (prev.decryptedCards[0] !== null ? prev.decryptedCards : (restoredCards ?? prev.decryptedCards)),
        // Track which hand the encryption state belongs to (for cross-hand leak prevention)
        encryptionHandNumber: resetEncryptionState ? null : (detectedCardsEncrypted ? currentHandNumber : prev.encryptionHandNumber),
        // Clear Ed25519 attestation instructions when hand changes (they're handle-specific)
        ed25519Instructions: resetEncryptionState ? [] : prev.ed25519Instructions,
        // Community card reveal state (from on-chain HandState)
        awaitingCommunityReveal: handState?.awaitingCommunityReveal ?? false,
        // Reset reveal state when not awaiting
        isRevealingCommunity: (handState?.awaitingCommunityReveal ?? false) ? prev.isRevealingCommunity : false,
      }));

      setError(null);
    } catch (e) {
      console.error("Error refreshing state:", e);
      setError(e instanceof Error ? e.message : "Failed to fetch game state");
    }
  }, [program, provider, gameState.tablePDA, publicKey, fetchPlayerSeats]);

  // Start polling when table is set
  useEffect(() => {
    if (gameState.tablePDA && program) {
      // Initial fetch
      refreshState();

      // Poll every 3 seconds
      pollingRef.current = setInterval(refreshState, 3000);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [gameState.tablePDA, program, refreshState]);

  // ============================================================
  // Arcium crypto lifecycle
  // Lazily fetch the MXE public key (once) and derive this wallet's x25519
  // encryption keys (one signature, cached). Both are needed to seal/decrypt
  // hole cards in the deal_to_seat MPC flow.
  // ============================================================
  const ensureCrypto = useCallback(async (): Promise<{ keys: EncryptionKeys; mxePublicKey: Uint8Array }> => {
    if (!provider || !program || !publicKey || !signMessage) {
      throw new Error("Wallet not connected");
    }
    if (!mxePublicKeyRef.current) {
      const key = await fetchMXEPublicKey(provider, program.programId);
      if (!key) throw new Error("Could not fetch Arcium MXE public key (nodes warming up?)");
      mxePublicKeyRef.current = key;
    }
    if (!encKeysRef.current) {
      encKeysRef.current = await deriveEncryptionKeys(
        { publicKey, signMessage },
        program.programId
      );
    }
    return { keys: encKeysRef.current, mxePublicKey: mxePublicKeyRef.current };
  }, [provider, program, publicKey, signMessage]);

  // Build the full account map for a queue_computation instruction: the shared
  // Arcium accounts plus this call's fresh computation offset.
  const buildQueueAccounts = useCallback(
    async (circuitName: string, computationOffset: BN) => {
      if (!program) throw new Error("Program not ready");
      return queueAccounts(program.programId, circuitName, computationOffset);
    },
    [program]
  );

  // ============================================================
  // Arcium MPC: shuffle the deck (authority action). Queues the `shuffle`
  // circuit; its callback seals the shuffled 52-card deck into DeckState as
  // opaque ciphertext. After this, each seated player deals themselves in via
  // deal_to_seat. Shared by requestShuffle() and the legacy dealCards() name.
  // ============================================================
  const doShuffle = useCallback(async (): Promise<string> => {
    if (!program || !provider || !publicKey || !gameState.tablePDA || !gameState.table) {
      throw new Error("Table not ready");
    }

    setLoading(true);
    setError(null);
    setGameState((prev) => ({ ...prev, isShuffling: true }));

    try {
      const handNumber = BigInt(gameState.table.handNumber.toNumber());
      const [handPDA] = getHandPDA(gameState.tablePDA, handNumber);
      const [deckPDA] = getDeckPDA(gameState.tablePDA, handNumber);

      const computationOffset = newComputationOffset();
      const arcium = await buildQueueAccounts("shuffle", computationOffset);

      const tx = await program.methods
        .shuffle(computationOffset)
        .accountsPartial({
          payer: publicKey,
          ...arcium,
          table: gameState.tablePDA,
          handState: handPDA,
          deckState: deckPDA,
        })
        .rpc();

      await provider.connection.confirmTransaction(tx, "confirmed");

      // Wait for the MPC callback to seal the deck on-chain (~15-20s on devnet).
      await awaitFinalization(provider, computationOffset, program.programId);

      setGameState((prev) => ({
        ...prev,
        isShuffling: false,
        isDeckShuffled: true,
        areCardsEncrypted: true,
        areAllowancesGranted: true,
        allPlayersHaveAllowances: true,
      }));

      await refreshState();
      return tx;
    } catch (e) {
      setGameState((prev) => ({ ...prev, isShuffling: false }));
      const message = parseAnchorError(e);
      setError(message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [program, provider, publicKey, gameState.tablePDA, gameState.table, buildQueueAccounts, refreshState]);

  // ============================================================
  // Arcium MPC: deal this player's own hole cards (deal_to_seat) and decrypt
  // them locally from the HoleDealt event. Only the seat owner can do this —
  // the cards seal to a key only they hold. Once every seated player has dealt
  // in, the program advances the hand to PreFlop.
  // ============================================================
  const dealToOwnSeat = useCallback(async (): Promise<void> => {
    if (!program || !provider || !publicKey || !gameState.tablePDA || !gameState.table || gameState.currentPlayerSeat === null) {
      throw new Error("Not at table");
    }

    setGameState((prev) => ({ ...prev, isDecrypting: true }));
    try {
      const { keys, mxePublicKey } = await ensureCrypto();

      const handNumber = BigInt(gameState.table.handNumber.toNumber());
      const [handPDA] = getHandPDA(gameState.tablePDA, handNumber);
      const [deckPDA] = getDeckPDA(gameState.tablePDA, handNumber);
      const seatIndex = gameState.currentPlayerSeat;
      const [seatPDA] = getSeatPDA(gameState.tablePDA, seatIndex);

      const computationOffset = newComputationOffset();
      const nonce = newNonce();
      const arcium = await buildQueueAccounts("deal_to_seat", computationOffset);

      const tx = await program.methods
        .dealToSeat(
          computationOffset,
          seatIndex,
          Array.from(keys.publicKey),
          nonce.bn
        )
        .accountsPartial({
          payer: publicKey,
          ...arcium,
          table: gameState.tablePDA,
          handState: handPDA,
          deckState: deckPDA,
          playerSeat: seatPDA,
        })
        .rpc();

      await provider.connection.confirmTransaction(tx, "confirmed");

      // The deal_to_seat callback emits a HoleDealt event addressed to our key.
      // Arcium runs the callback in its own tx (plus a duplicate that fails), so
      // awaitFinalization's returned sig is NOT reliably the one carrying the
      // event — scan the recent program txs for it instead (verified on devnet).
      await awaitFinalization(provider, computationOffset, program.programId);
      await new Promise((r) => setTimeout(r, 2500)); // let the callback tx land
      const events = await scanRecentEvents(provider.connection, program, program.programId);

      const myPubHex = Buffer.from(keys.publicKey).toString("hex");
      let decrypted: [number, number] | null = null;
      for (const ev of events) {
        if (ev.name !== "holeDealt" && ev.name !== "HoleDealt") continue;
        const d = ev.data as { encPubkey?: number[]; enc_pubkey?: number[]; nonce: number[]; card0: number[]; card1: number[] };
        const encPubkey = d.encPubkey ?? d.enc_pubkey ?? [];
        if (Buffer.from(encPubkey).toString("hex") !== myPubHex) continue;
        decrypted = await decryptHoleCards(keys.privateKey, mxePublicKey, d.card0, d.card1, d.nonce);
        break;
      }

      if (!decrypted) {
        throw new Error("Dealt, but no matching HoleDealt event found to decrypt");
      }

      // Persist so a page refresh doesn't lose our only copy of these cards.
      saveHoleCards(gameState.tablePDA, gameState.table.handNumber.toNumber(), seatIndex, decrypted);

      setGameState((prev) => ({
        ...prev,
        isDecrypting: false,
        decryptedCards: decrypted,
        encryptionHandNumber: gameState.table!.handNumber.toNumber(),
      }));
      await refreshState();
    } catch (e) {
      setGameState((prev) => ({ ...prev, isDecrypting: false }));
      throw e;
    }
  }, [program, provider, publicKey, gameState.tablePDA, gameState.table, gameState.currentPlayerSeat, ensureCrypto, buildQueueAccounts, refreshState]);

  // Create a new table
  const createTable = useCallback(
    async (config: CreateTableConfig): Promise<string> => {
      if (!program || !provider || !publicKey) {
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      setError(null);

      try {
        const tableIdBytes = generateTableId(config.tableId);
        const [tablePDA] = getTablePDA(tableIdBytes);
        const [vaultPDA] = getVaultPDA(tablePDA);

        // Check if table already exists using getAccountInfo (cleaner than fetch)
        const existingAccount = await provider.connection.getAccountInfo(tablePDA);
        if (existingAccount !== null) {
          // Table exists - load it and inform user
          setTableId(config.tableId);
          await refreshState();
          throw new Error(`Table "${config.tableId}" already exists. Loading existing table instead.`);
        }

        // Use the configured token mint (default: USDC for the current network)
        const token = config.tokenMint
          ? getTokenByMint(config.tokenMint) ?? getDefaultToken()
          : getDefaultToken();

        const tx = await program.methods
          .createTable(
            Array.from(tableIdBytes),
            new BN(config.smallBlind),
            new BN(config.bigBlind),
            new BN(config.minBuyIn),
            new BN(config.maxBuyIn),
            config.maxPlayers,
            config.rakeBps ?? 0,
            new BN(config.rakeCap ?? 0)
          )
          .accounts({
            authority: publicKey,
            table: tablePDA,
            mint: token.mint,
            vault: vaultPDA,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        // Update local state
        setTableId(config.tableId);
        await refreshState();

        return tx;
      } catch (e) {
        const message = parseAnchorError(e);
        setError(message);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [program, provider, publicKey, setTableId, refreshState]
  );

  // Join table — bundles session key creation in the same transaction
  // so the player gets popup-free gameplay from the moment they sit down.
  const joinTable = useCallback(
    async (seatIndex: number, buyInLamports: number): Promise<string> => {
      if (!program || !provider || !publicKey || !gameState.tablePDA) {
        throw new Error("Wallet not connected or table not set");
      }

      setLoading(true);
      setError(null);

      try {
        const [seatPDA] = getSeatPDA(gameState.tablePDA, seatIndex);
        const [vaultPDA] = getVaultPDA(gameState.tablePDA);

        // Get table's token mint for SPL transfer
        const tableMint = gameState.table!.tokenMint;
        const playerTokenAccount = getAssociatedTokenAddressSync(tableMint, publicKey);

        // Build join_table instruction
        const joinIx = await program.methods
          .joinTable(seatIndex, new BN(buyInLamports))
          .accounts({
            player: publicKey,
            table: gameState.tablePDA,
            playerSeat: seatPDA,
            playerTokenAccount,
            vault: vaultPDA,
            mint: tableMint,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction();

        // Build session key creation instruction (bundled in same tx)
        const ephemeral = Keypair.generate();
        const now = Math.floor(Date.now() / 1000);
        const expiry = now + SESSION_DURATION_SECONDS;
        const [sessionPDA] = getSessionTokenPDA(PROGRAM_ID, ephemeral.publicKey, publicKey);

        const sessionIx = buildCreateSessionInstruction(
          ephemeral.publicKey,
          publicKey,
          sessionPDA,
          expiry
        );

        // Bundle both instructions in one transaction — one wallet popup
        const tx = new Transaction();
        tx.add(joinIx);
        tx.add(sessionIx);

        const { blockhash, lastValidBlockHeight } =
          await provider.connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey;

        // Ephemeral key must co-sign (required by create_session)
        tx.partialSign(ephemeral);

        // Wallet signs everything (one popup for both join + session)
        const signedTx = await provider.wallet.signTransaction(tx);
        const signature = await provider.connection.sendRawTransaction(
          signedTx.serialize()
        );

        await provider.connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          "confirmed"
        );

        // Activate the session in the hook state
        if (sessionKey?.activateSession) {
          sessionKey.activateSession(ephemeral, sessionPDA, expiry);
        } else {
          // Fallback: persist directly if hook not wired yet
          saveSession(ephemeral, sessionPDA, expiry, publicKey);
        }

        await refreshState();
        return signature;
      } catch (e) {
        const message = parseAnchorError(e, {
          minBuyIn: gameState.table?.minBuyIn.toNumber(),
          maxBuyIn: gameState.table?.maxBuyIn.toNumber(),
        });
        setError(message);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [program, provider, publicKey, gameState.tablePDA, gameState.table, refreshState, sessionKey]
  );

  // Leave table
  const leaveTable = useCallback(async (): Promise<string> => {
    if (!program || !provider || !publicKey || !gameState.tablePDA || gameState.currentPlayerSeat === null) {
      throw new Error("Not at table");
    }

    setLoading(true);
    setError(null);

    try {
      const [seatPDA] = getSeatPDA(gameState.tablePDA, gameState.currentPlayerSeat);
      const [vaultPDA] = getVaultPDA(gameState.tablePDA);

      // Get table's token mint for SPL transfer
      const tableMint = gameState.table!.tokenMint;
      const playerTokenAccount = getAssociatedTokenAddressSync(tableMint, publicKey);

      const tx = await program.methods
        .leaveTable()
        .accounts({
          player: publicKey,
          table: gameState.tablePDA,
          playerSeat: seatPDA,
          playerTokenAccount,
          vault: vaultPDA,
          mint: tableMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await provider.connection.confirmTransaction(tx, "confirmed");
      await refreshState();
      return tx;
    } catch (e) {
      const message = parseAnchorError(e);
      setError(message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [program, provider, publicKey, gameState.tablePDA, gameState.currentPlayerSeat, refreshState]);

  // Start hand (authority only)
  const startHand = useCallback(async (): Promise<string> => {
    if (!program || !provider || !publicKey || !gameState.tablePDA || !gameState.table) {
      throw new Error("Table not ready");
    }

    setLoading(true);
    setError(null);

    // IMPORTANT: Reset ALL encryption state when starting a new hand
    // This prevents stale state from previous hands from leaking through
    setGameState((prev) => ({
      ...prev,
      areCardsEncrypted: false,
      areAllowancesGranted: false,
      allPlayersHaveAllowances: false,
      isEncrypting: false,
      isDecrypting: false,
      decryptedCards: [null, null],
      encryptionHandNumber: null,
      ed25519Instructions: [], // Clear attestation instructions from previous hand
    }));

    try {
      const handNumber = BigInt(gameState.table.handNumber.toNumber() + 1);
      const [handPDA] = getHandPDA(gameState.tablePDA, handNumber);
      const [deckPDA] = getDeckPDA(gameState.tablePDA, handNumber);

      const tx = await program.methods
        .startHand()
        .accounts({
          caller: publicKey,
          table: gameState.tablePDA,
          handState: handPDA,
          deckState: deckPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await provider.connection.confirmTransaction(tx, "confirmed");
      await refreshState();
      return tx;
    } catch (e) {
      const message = parseAnchorError(e);
      setError(message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [program, provider, publicKey, gameState.tablePDA, gameState.table, refreshState]);

  // Legacy name kept for the table-page "Deal Cards" control. In the Arcium
  // build there is no separate deal step for the authority — dealing the deck
  // means running the MPC shuffle; each player then deals themselves in.
  const dealCards = useCallback((): Promise<string> => doShuffle(), [doShuffle]);

  // ============================================================
  // Shuffle the deck via Arcium MPC (authority action). See doShuffle().
  // ============================================================
  const requestShuffle = useCallback((): Promise<string> => doShuffle(), [doShuffle]);

  // ============================================================
  // Retired Inco encrypt/allowance steps. With Arcium MPC the deck is sealed
  // by the shuffle circuit and each player decrypts their own hole cards from
  // the HoleDealt event — there is nothing to encrypt or grant. These stubs
  // keep the hook's public API stable for the existing table-page UI; they
  // resolve immediately.
  // ============================================================
  const encryptHoleCards = useCallback(async (_seatIndex: number): Promise<string> => "", []);
  const grantCardAllowance = useCallback(async (_seatIndex: number): Promise<string> => "", []);
  const encryptAndGrantCards = useCallback(async (_seatIndex: number): Promise<void> => {}, []);
  const encryptAllPlayersCards = useCallback(async (): Promise<void> => {}, []);
  const grantAllPlayersAllowances = useCallback(async (): Promise<void> => {}, []);

  // ============================================================
  // Arcium MPC: "decrypt my cards" now means deal this player into the hand
  // (deal_to_seat) and decrypt the sealed hole cards from the HoleDealt event.
  // ============================================================
  const decryptMyCards = useCallback(async (): Promise<void> => {
    await dealToOwnSeat();
  }, [dealToOwnSeat]);

  // ============================================================
  // Arcium MPC: reveal all non-folded hole cards at showdown in ONE batched
  // round-trip (showdown_reveal). The callback writes each revealed seat's
  // plaintext cards on-chain; polling then surfaces them via revealedCards.
  // Replaces the old per-player Ed25519 reveal — any player can trigger it
  // once at Showdown, and the circuit only reveals seats still in the hand.
  // ============================================================
  const revealCards = useCallback(async (): Promise<string> => {
    if (!program || !provider || !publicKey || !gameState.tablePDA || !gameState.table) {
      throw new Error("Not ready to reveal");
    }
    if (gameState.phase !== "Showdown") {
      throw new Error("Reveal is only available at showdown");
    }
    if (showdownRevealInProgressRef.current) return "";
    showdownRevealInProgressRef.current = true;
    setGameState((prev) => ({ ...prev, isRevealing: true }));

    try {
      const handNumber = BigInt(gameState.table.handNumber.toNumber());
      const [handPDA] = getHandPDA(gameState.tablePDA, handNumber);
      const [deckPDA] = getDeckPDA(gameState.tablePDA, handNumber);

      // All occupied seats in ascending order. The circuit reveals only the
      // non-folded ones (mask built on-chain from fold tracking) and writes
      // their cards back via these same accounts in the callback.
      const occupied = getOccupiedSeats(gameState.table.occupiedSeats, gameState.table.maxPlayers);
      const seatMetas = occupied.map((seatIndex) => {
        const [seatPDA] = getSeatPDA(gameState.tablePDA!, seatIndex);
        return { pubkey: seatPDA, isSigner: false, isWritable: true };
      });

      const computationOffset = newComputationOffset();
      const arcium = await buildQueueAccounts("showdown_reveal", computationOffset);

      const tx = await program.methods
        .showdownReveal(computationOffset)
        .accountsPartial({
          payer: publicKey,
          ...arcium,
          table: gameState.tablePDA,
          handState: handPDA,
          deckState: deckPDA,
        })
        .remainingAccounts(seatMetas)
        .rpc();

      await provider.connection.confirmTransaction(tx, "confirmed");
      await awaitFinalization(provider, computationOffset, program.programId);

      setGameState((prev) => ({ ...prev, isRevealing: false }));
      await refreshState();
      return tx;
    } catch (e) {
      const message = parseAnchorError(e);
      setError(message);
      setGameState((prev) => ({ ...prev, isRevealing: false }));
      throw e;
    } finally {
      showdownRevealInProgressRef.current = false;
    }
  }, [program, provider, publicKey, gameState.tablePDA, gameState.table, gameState.phase, buildQueueAccounts, refreshState]);

  // ============================================================
  // Arcium MPC: reveal the community board. Each street is its own circuit
  // (reveal_flop <- PreFlop, reveal_turn <- Flop, reveal_river <- Turn); the
  // callback re-feeds the sealed deck, writes the plaintext board on-chain, and
  // advances the phase. The board is public — no client-side decryption. The
  // authority can reveal immediately; anyone else after the on-chain AFK
  // timeout. All-in runout is handled on-chain (awaitingCommunityReveal stays
  // set so the next street fires automatically via the auto-reveal effect).
  // ============================================================
  const revealCommunityCards = useCallback(async (): Promise<string> => {
    if (communityRevealInProgressRef.current) {
      return ""; // already in progress
    }
    if (!program || !provider || !publicKey || !gameState.tablePDA || !gameState.table || !gameState.handState) {
      throw new Error("Not ready to reveal community cards");
    }
    if (!gameState.awaitingCommunityReveal) {
      throw new Error("Not awaiting community reveal");
    }

    // Pick the circuit for the current street.
    const phase = gameState.phase;
    let circuit: string;
    if (phase === "PreFlop") circuit = "reveal_flop";
    else if (phase === "Flop") circuit = "reveal_turn";
    else if (phase === "Turn") circuit = "reveal_river";
    else throw new Error(`Invalid phase for community reveal: ${phase}`);

    // Non-authority must wait for the on-chain AFK timeout (the program also
    // validates it); pre-check with cluster time to avoid a doomed tx.
    if (!gameState.isAuthority) {
      const lastActionTimeBN = gameState.handState?.lastActionTime;
      const lastActionTime = typeof lastActionTimeBN === 'number' ? lastActionTimeBN : lastActionTimeBN?.toNumber?.() ?? 0;
      const slot = await provider.connection.getSlot();
      const clusterTime = await provider.connection.getBlockTime(slot);
      if (!clusterTime) throw new Error("Could not fetch Solana cluster time");
      const elapsed = clusterTime - lastActionTime;
      const COMMUNITY_REVEAL_TIMEOUT = 60;
      if (elapsed < COMMUNITY_REVEAL_TIMEOUT) {
        throw new Error(`Non-authority must wait ${Math.ceil(COMMUNITY_REVEAL_TIMEOUT - elapsed)}s more for timeout`);
      }
    }

    communityRevealInProgressRef.current = true;
    setGameState((prev) => ({ ...prev, isRevealingCommunity: true }));

    try {
      const handNumber = BigInt(gameState.table.handNumber.toNumber());
      const [handPDA] = getHandPDA(gameState.tablePDA, handNumber);
      const [deckPDA] = getDeckPDA(gameState.tablePDA, handNumber);

      const computationOffset = newComputationOffset();
      const arcium = await buildQueueAccounts(circuit, computationOffset);

      const builder =
        circuit === "reveal_flop"
          ? program.methods.revealFlop(computationOffset)
          : circuit === "reveal_turn"
          ? program.methods.revealTurn(computationOffset)
          : program.methods.revealRiver(computationOffset);

      // Optional session_token must be explicit null when absent (@anchor-lang/core);
      // build as `any` since accountsPartial's typed shape rejects null.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const revealAccts: any = {
        payer: publicKey,
        caller: publicKey,
        ...arcium,
        table: gameState.tablePDA,
        handState: handPDA,
        deckState: deckPDA,
        sessionToken: null,
      };
      const tx = await builder.accountsPartial(revealAccts).rpc();

      await provider.connection.confirmTransaction(tx, "confirmed");
      // Callback writes the board on-chain and advances the phase.
      await awaitFinalization(provider, computationOffset, program.programId);

      setGameState((prev) => ({ ...prev, isRevealingCommunity: false, awaitingCommunityReveal: false }));
      await refreshState();
      setTimeout(() => { communityRevealInProgressRef.current = false; }, 1000);
      return tx;
    } catch (e) {
      communityRevealInProgressRef.current = false;
      setGameState((prev) => ({ ...prev, isRevealingCommunity: false }));
      const message = parseAnchorError(e);
      setError(message);
      throw e;
    }
  }, [program, provider, publicKey, gameState.tablePDA, gameState.table, gameState.handState, gameState.phase, gameState.isAuthority, gameState.awaitingCommunityReveal, buildQueueAccounts, refreshState]);

  // ============================================================
  // Auto-reveal community cards:
  // - Authority can reveal immediately
  // - Non-authority can reveal after 60 second timeout (for AFK authority)
  // ============================================================
  useEffect(() => {
    // Check if we're waiting for community reveal and not already revealing
    // Also check ref to prevent duplicate attempts from useEffect re-runs
    if (!gameState.awaitingCommunityReveal || gameState.isRevealingCommunity || communityRevealInProgressRef.current) {
      return;
    }

    // Only reveal during valid phases (PreFlop, Flop, Turn)
    const phase = gameState.phase;
    if (phase !== "PreFlop" && phase !== "Flop" && phase !== "Turn") {
      console.log(`[Auto-reveal] Skipping - invalid phase for community reveal: ${phase}`);
      return;
    }

    // Authority can reveal immediately
    if (gameState.isAuthority) {
      console.log("[Auto-reveal] Authority detected awaitingCommunityReveal, triggering reveal...");

      const timeout = setTimeout(() => {
        revealCommunityCards()
          .then((sig) => {
            if (sig) {
              console.log("[Auto-reveal] Community cards revealed:", sig);
            }
          })
          .catch((e) => {
            const errorMsg = e instanceof Error ? e.message : String(e);
            if (!errorMsg.includes("Not awaiting") && !errorMsg.includes("CommunityNotReady")) {
              console.error("[Auto-reveal] Failed to reveal community cards:", e);
              setError(errorMsg);
            } else {
              console.log("[Auto-reveal] Reveal skipped (already completed)");
            }
          });
      }, 500);

      return () => clearTimeout(timeout);
    }

    // Non-authority: check if timeout has passed (60 seconds)
    const lastActionTimeBN = gameState.handState?.lastActionTime;
    if (!lastActionTimeBN) return;

    const lastActionTime = typeof lastActionTimeBN === 'number' ? lastActionTimeBN : lastActionTimeBN.toNumber();
    const elapsed = Date.now() / 1000 - lastActionTime;
    const COMMUNITY_REVEAL_TIMEOUT = 60; // Same as ALLOWANCE_TIMEOUT_SECONDS
    // Add buffer for clock skew between local time and Solana cluster time
    // The actual revealCommunityCards function uses cluster time for authoritative check
    const CLOCK_SKEW_BUFFER = 5;

    if (elapsed >= COMMUNITY_REVEAL_TIMEOUT + CLOCK_SKEW_BUFFER) {
      console.log(`[Auto-reveal] Non-authority can reveal after ${elapsed.toFixed(0)}s timeout (with ${CLOCK_SKEW_BUFFER}s buffer), triggering...`);

      const timeout = setTimeout(() => {
        revealCommunityCards()
          .then((sig) => {
            if (sig) {
              console.log("[Auto-reveal] Community cards revealed by non-authority:", sig);
            }
          })
          .catch((e) => {
            const errorMsg = e instanceof Error ? e.message : String(e);
            if (!errorMsg.includes("Not awaiting") && !errorMsg.includes("CommunityNotReady") && !errorMsg.includes("TimeoutNotReached")) {
              console.error("[Auto-reveal] Non-authority failed to reveal:", e);
              // Don't show error to user - authority might still reveal
            } else {
              console.log("[Auto-reveal] Non-authority reveal skipped (already completed or timeout not reached)");
            }
          });
      }, 500);

      return () => clearTimeout(timeout);
    }

    // If timeout hasn't passed yet, set up a timer to check again
    const remainingTime = (COMMUNITY_REVEAL_TIMEOUT + CLOCK_SKEW_BUFFER - elapsed) * 1000;
    if (remainingTime > 0) {
      console.log(`[Auto-reveal] Non-authority waiting ${(remainingTime / 1000).toFixed(1)}s for timeout...`);
      const checkTimer = setTimeout(() => {
        // This will trigger a re-render via state change from refreshState
        // The useEffect will run again and check the timeout
      }, Math.min(remainingTime, 5000)); // Check every 5 seconds max

      return () => clearTimeout(checkTimer);
    }
  }, [gameState.isAuthority, gameState.awaitingCommunityReveal, gameState.isRevealingCommunity, gameState.handState?.lastActionTime, revealCommunityCards]);

  // ============================================================
  // Retired liveness instructions. Under Arcium MPC there are no per-card
  // allowances (grant_own_allowance) and showdown reveal is a single batched
  // MPC call driven by revealCards() rather than a per-player Ed25519 reveal
  // that could time out (timeout_reveal). These stubs keep the public API
  // stable for the table page; they resolve immediately.
  // ============================================================
  const grantOwnAllowance = useCallback(async (): Promise<string> => "", []);
  const timeoutReveal = useCallback(async (_targetSeat: number): Promise<string> => "", []);

  // ============================================================
  // Game Liveness: Close inactive table and return funds
  // ============================================================
  const closeInactiveTable = useCallback(async (): Promise<string> => {
    if (!program || !provider || !publicKey || !gameState.tablePDA || !gameState.table) {
      throw new Error("Not ready - wallet not connected or no table");
    }

    setLoading(true);
    setError(null);

    try {
      const [vaultPDA] = getVaultPDA(gameState.tablePDA);
      const tableMint = gameState.table.tokenMint;

      // Build remaining accounts: [seat, player_token_account, seat, player_token_account, ...]
      const remainingAccounts: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] = [];

      for (const player of gameState.players) {
        if (player.status !== "empty" && player.player) {
          const [seatPDA] = getSeatPDA(gameState.tablePDA, player.seatIndex);
          const playerTokenAccount = getAssociatedTokenAddressSync(
            tableMint,
            new PublicKey(player.player),
          );
          remainingAccounts.push(
            { pubkey: seatPDA, isSigner: false, isWritable: true },
            { pubkey: playerTokenAccount, isSigner: false, isWritable: true }
          );
        }
      }

      console.log(`Closing inactive table, returning funds to ${remainingAccounts.length / 2} players...`);

      const tx = await program.methods
        .closeInactiveTable()
        .accounts({
          caller: publicKey,
          table: gameState.tablePDA,
          vault: vaultPDA,
          mint: tableMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(remainingAccounts)
        .rpc();

      await provider.connection.confirmTransaction(tx, "confirmed");
      console.log("Table closed and funds returned:", tx);

      // Clear local state
      setGameState((prev) => ({
        ...prev,
        tableStatus: "Closed",
        players: [],
      }));

      return tx;
    } catch (e) {
      const message = parseAnchorError(e);
      setError(message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [program, provider, publicKey, gameState.tablePDA, gameState.table, gameState.players]);

  // Player action
  const playerAction = useCallback(
    async (action: ActionType): Promise<string> => {
      if (!program || !provider || !publicKey || !gameState.tablePDA || !gameState.table || gameState.currentPlayerSeat === null) {
        throw new Error("Not at table");
      }

      const handNumber = BigInt(gameState.table.handNumber.toNumber());
      const [handPDA] = getHandPDA(gameState.tablePDA, handNumber);

      setLoading(true);
      setError(null);

      try {
        const [deckPDA] = getDeckPDA(gameState.tablePDA, handNumber);
        const [seatPDA] = getSeatPDA(gameState.tablePDA, gameState.currentPlayerSeat);

        // Build action argument
        let actionArg: object;
        switch (action.type) {
          case "fold":
            actionArg = { fold: {} };
            break;
          case "check":
            actionArg = { check: {} };
            break;
          case "call":
            actionArg = { call: {} };
            break;
          case "raise":
            actionArg = { raise: { amount: new BN(action.amount) } };
            break;
          case "allIn":
            actionArg = { allIn: {} };
            break;
        }

        let tx: string;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const accounts: any = {
          signer: sessionKey?.isActive ? sessionKey.signerPublicKey : publicKey,
          table: gameState.tablePDA,
          handState: handPDA,
          deckState: deckPDA,
          playerSeat: seatPDA,
          // Optional session_token: @anchor-lang/core requires it be explicitly
          // null when absent, else validateAccounts throws "not provided".
          sessionToken: sessionKey?.isActive ? sessionKey.sessionTokenPDA : null,
        };

        if (sessionKey?.isActive) {
          // Session key path — sign with ephemeral key, no wallet popup
          const txn = await program.methods
            .playerAction(actionArg)
            .accountsPartial(accounts)
            .transaction();

          tx = await sessionKey.sendWithSession(txn);
        } else {
          // Direct wallet path — standard .rpc() with wallet approval
          tx = await program.methods
            .playerAction(actionArg)
            .accountsPartial(accounts)
            .rpc();

          await provider.connection.confirmTransaction(tx, "confirmed");
        }
        await refreshState();
        return tx;
      } catch (e) {
        const message = parseAnchorError(e);
        setError(message);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [program, provider, publicKey, gameState.tablePDA, gameState.table, gameState.currentPlayerSeat, refreshState, sessionKey]
  );

  // Showdown (authority can call immediately, anyone else after timeout)
  const showdown = useCallback(async (): Promise<string> => {
    if (!program || !provider || !publicKey || !gameState.tablePDA || !gameState.table) {
      throw new Error("Table not ready");
    }

    setLoading(true);
    setError(null);

    try {
      const handNumber = BigInt(gameState.table.handNumber.toNumber());
      const [handPDA] = getHandPDA(gameState.tablePDA, handNumber);
      const [vaultPDA] = getVaultPDA(gameState.tablePDA);

      // Get all player seat PDAs as remaining accounts
      const occupied = getOccupiedSeats(gameState.table.occupiedSeats, gameState.table.maxPlayers);
      console.log("[Showdown] Occupied seats:", occupied, "from occupiedSeats bitmask:", gameState.table.occupiedSeats);

      const remainingAccounts: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] = [];

      for (const seatIndex of occupied) {
        const [seatPDA] = getSeatPDA(gameState.tablePDA!, seatIndex);
        try {
          const accountInfo = await provider.connection.getAccountInfo(seatPDA);
          if (accountInfo && accountInfo.data.length > 0) {
            remainingAccounts.push({
              pubkey: seatPDA,
              isSigner: false,
              isWritable: true,
            });
            console.log(`[Showdown] Added seat ${seatIndex}:`, seatPDA.toString());
          } else {
            console.warn(`[Showdown] Seat ${seatIndex} has no data, skipping`);
          }
        } catch (e) {
          console.warn(`[Showdown] Seat ${seatIndex} account not found, skipping:`, e);
        }
      }

      console.log("[Showdown] Passing", remainingAccounts.length, "seat accounts to showdown");

      const tx = await program.methods
        .showdown()
        .accounts({
          caller: publicKey,
          table: gameState.tablePDA,
          handState: handPDA,
        })
        .remainingAccounts(remainingAccounts)
        .rpc();

      await provider.connection.confirmTransaction(tx, "confirmed");
      await refreshState();
      return tx;
    } catch (e) {
      const message = parseAnchorError(e);
      setError(message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [program, provider, publicKey, gameState.tablePDA, gameState.table, refreshState]);

  // Timeout a player who hasn't acted in time (anyone can call)
  const timeoutPlayer = useCallback(async (): Promise<string> => {
    if (!program || !provider || !publicKey || !gameState.tablePDA || !gameState.table || !gameState.handState) {
      throw new Error("Table not ready");
    }

    const handNumber = BigInt(gameState.table.handNumber.toNumber());
    const [handPDA] = getHandPDA(gameState.tablePDA, handNumber);

    setLoading(true);
    setError(null);

    try {
      const [deckPDA] = getDeckPDA(gameState.tablePDA, handNumber);

      // Get the seat of the player whose turn it is
      const actionOn = gameState.handState.actionOn;
      const [timedOutSeatPDA] = getSeatPDA(gameState.tablePDA, actionOn);

      const tx = await program.methods
        .timeoutPlayer()
        .accounts({
          caller: publicKey,
          table: gameState.tablePDA,
          handState: handPDA,
          deckState: deckPDA,
          playerSeat: timedOutSeatPDA,
        })
        .rpc();

      await provider.connection.confirmTransaction(tx, "confirmed");
      await refreshState();
      return tx;
    } catch (e) {
      const message = parseAnchorError(e);
      setError(message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [program, provider, publicKey, gameState.tablePDA, gameState.table, gameState.handState, refreshState]);

  return {
    gameState,
    loading,
    error,
    createTable,
    joinTable,
    leaveTable,
    startHand,
    dealCards,
    playerAction,
    showdown,
    timeoutPlayer,
    // MagicBlock VRF
    requestShuffle,
    // Inco TEE Encryption
    encryptHoleCards,
    grantCardAllowance,
    encryptAndGrantCards,
    encryptAllPlayersCards,
    grantAllPlayersAllowances,
    decryptMyCards,
    revealCards,
    // Game Liveness (prevent stuck games)
    grantOwnAllowance,
    timeoutReveal,
    closeInactiveTable,
    // Community card reveal (privacy feature)
    revealCommunityCards,
    // Utilities
    refreshState,
    setTableId,
    setUseVrf,
    setUseIncoPrivacy,
    // Program instance for event listeners
    program,
  };
}
