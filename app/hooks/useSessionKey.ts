"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  Connection,
} from "@solana/web3.js";
import { BN, AnchorProvider } from "@coral-xyz/anchor";
import { PROGRAM_ID } from "@/lib/program";

// ─── Constants ───────────────────────────────────────────────────────

/** MagicBlock Session Keys program (deployed on devnet + mainnet) */
const SESSION_KEYS_PROGRAM_ID = new PublicKey(
  "KeyspM2ssCJbqUhQ4k7sveSiY4WjnYsrXkC8oDbwde5"
);

/** Default session duration: 4 hours */
const SESSION_DURATION_SECONDS = 4 * 60 * 60;

/** SOL to fund the ephemeral key for tx fees (~200 transactions) */
const SESSION_TOPUP_LAMPORTS = 10_000_000; // 0.01 SOL

/** localStorage key for persisting session across page reloads */
const STORAGE_KEY = "hh-session";

/** Minimum remaining validity before we warn the user (5 minutes) */
const EXPIRY_WARNING_SECONDS = 5 * 60;

// ─── Session-keys program instruction discriminators ─────────────────
// Generated from: sha256("global:create_session")[..8]
// These are stable for the deployed program at KeyspM2s...
const CREATE_SESSION_DISCRIMINATOR = Buffer.from([
  0xf2, 0xc1, 0x8f, 0xb3, 0x96, 0x19, 0x7a, 0xe3,
]);
const REVOKE_SESSION_DISCRIMINATOR = Buffer.from([
  0x56, 0x5c, 0xc6, 0x78, 0x90, 0x02, 0x07, 0xc2,
]);

// ─── Types ───────────────────────────────────────────────────────────

interface StoredSession {
  /** Base58-encoded secret key of the ephemeral keypair */
  secretKey: string;
  /** Session token PDA address (base58) */
  sessionTokenPDA: string;
  /** Unix timestamp (seconds) when the session expires */
  validUntil: number;
  /** The real wallet pubkey this session belongs to (base58) */
  authority: string;
}

export interface SessionKeyState {
  /** Whether a valid (non-expired) session exists */
  isActive: boolean;
  /** The ephemeral keypair for signing transactions */
  keypair: Keypair | null;
  /** The session token PDA that proves the session is valid on-chain */
  sessionTokenPDA: PublicKey | null;
  /** Seconds remaining until expiry */
  remainingSeconds: number;
  /** Whether the session is close to expiring */
  isExpiring: boolean;
}

export interface UseSessionKeyResult {
  /** Current session state */
  session: SessionKeyState;
  /** Create a new session (requires one wallet approval) */
  createSession: (durationSeconds?: number) => Promise<void>;
  /** Revoke the current session and clean up */
  revokeSession: () => Promise<void>;
  /**
   * Sign and send a transaction using the session key.
   * Returns the transaction signature.
   */
  sendWithSession: (tx: Transaction) => Promise<string>;
  /** Whether a session creation/revocation is in progress */
  loading: boolean;
  /** Last error message, if any */
  error: string | null;
}

// ─── PDA derivation ──────────────────────────────────────────────────

function getSessionTokenPDA(
  targetProgram: PublicKey,
  sessionSigner: PublicKey,
  authority: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("session_token"),
      targetProgram.toBuffer(),
      sessionSigner.toBuffer(),
      authority.toBuffer(),
    ],
    SESSION_KEYS_PROGRAM_ID
  );
}

// ─── Build instructions ──────────────────────────────────────────────

function writeI64LE(value: number): Uint8Array {
  const buf = new Uint8Array(8);
  // Write as two 32-bit halves to avoid BigInt browser compatibility issues
  const low = value & 0xffffffff;
  const high = Math.floor(value / 0x100000000) & 0xffffffff;
  buf[0] = low & 0xff;
  buf[1] = (low >> 8) & 0xff;
  buf[2] = (low >> 16) & 0xff;
  buf[3] = (low >> 24) & 0xff;
  buf[4] = high & 0xff;
  buf[5] = (high >> 8) & 0xff;
  buf[6] = (high >> 16) & 0xff;
  buf[7] = (high >> 24) & 0xff;
  return buf;
}

function buildCreateSessionInstruction(
  sessionSigner: PublicKey,
  authority: PublicKey,
  sessionTokenPDA: PublicKey,
  validUntil: number
): TransactionInstruction {
  // Anchor serialization: discriminator + Option<bool> + Option<i64> + Option<u64>
  // Option<T> encoding: 0x01 + value (Some), or 0x00 (None)
  const parts: Uint8Array[] = [];

  // discriminator (8 bytes)
  parts.push(new Uint8Array(CREATE_SESSION_DISCRIMINATOR));

  // top_up: Option<bool> = Some(true)
  parts.push(new Uint8Array([1, 1]));

  // valid_until: Option<i64> = Some(validUntil)
  parts.push(new Uint8Array([1]));
  parts.push(writeI64LE(validUntil));

  // lamports: Option<u64> = None (use default 0.01 SOL)
  parts.push(new Uint8Array([0]));

  // Concatenate all parts
  const totalLen = parts.reduce((sum, p) => sum + p.length, 0);
  const data = Buffer.alloc(totalLen);
  let offset = 0;
  for (const part of parts) {
    data.set(part, offset);
    offset += part.length;
  }

  return new TransactionInstruction({
    programId: SESSION_KEYS_PROGRAM_ID,
    keys: [
      { pubkey: sessionTokenPDA, isSigner: false, isWritable: true },
      { pubkey: sessionSigner, isSigner: true, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: PROGRAM_ID, isSigner: false, isWritable: false }, // target_program
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function buildRevokeSessionInstruction(
  sessionTokenPDA: PublicKey,
  authority: PublicKey
): TransactionInstruction {
  // revoke_session has no args — just the 8-byte discriminator
  // Note: v1 revoke does NOT require authority to be a signer
  return new TransactionInstruction({
    programId: SESSION_KEYS_PROGRAM_ID,
    keys: [
      { pubkey: sessionTokenPDA, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: REVOKE_SESSION_DISCRIMINATOR,
  });
}

// ─── Persistence helpers ─────────────────────────────────────────────

function saveSession(
  keypair: Keypair,
  sessionTokenPDA: PublicKey,
  validUntil: number,
  authority: PublicKey
): void {
  const stored: StoredSession = {
    secretKey: Buffer.from(keypair.secretKey).toString("base64"),
    sessionTokenPDA: sessionTokenPDA.toBase58(),
    validUntil,
    authority: authority.toBase58(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // localStorage may be unavailable (incognito/storage full) — session
    // still works for current page lifetime via in-memory state
    console.warn("[SessionKey] Could not persist session to localStorage");
  }
}

function loadSession(currentAuthority: PublicKey | null): {
  keypair: Keypair;
  sessionTokenPDA: PublicKey;
  validUntil: number;
} | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored: StoredSession = JSON.parse(raw);

    // Don't restore a session belonging to a different wallet
    if (currentAuthority && stored.authority !== currentAuthority.toBase58()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (stored.validUntil <= now) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return {
      keypair: Keypair.fromSecretKey(
        Uint8Array.from(Buffer.from(stored.secretKey, "base64"))
      ),
      sessionTokenPDA: new PublicKey(stored.sessionTokenPDA),
      validUntil: stored.validUntil,
    };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function clearStoredSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useSessionKey(
  provider: AnchorProvider | null,
  publicKey: PublicKey | null
): UseSessionKeyResult {
  const [keypair, setKeypair] = useState<Keypair | null>(null);
  const [sessionTokenPDA, setSessionTokenPDA] = useState<PublicKey | null>(null);
  const [validUntil, setValidUntil] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Restore session from localStorage on wallet connect ───────────
  useEffect(() => {
    if (!publicKey) {
      setKeypair(null);
      setSessionTokenPDA(null);
      setValidUntil(0);
      return;
    }

    const stored = loadSession(publicKey);
    if (stored) {
      setKeypair(stored.keypair);
      setSessionTokenPDA(stored.sessionTokenPDA);
      setValidUntil(stored.validUntil);
    }
  }, [publicKey]);

  // ── Countdown timer ────────────────────────────────────────────────
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (!validUntil) {
      setRemainingSeconds(0);
      return;
    }

    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = Math.max(0, validUntil - now);
      setRemainingSeconds(remaining);

      // Auto-clear expired session
      if (remaining === 0) {
        setKeypair(null);
        setSessionTokenPDA(null);
        setValidUntil(0);
        clearStoredSession();
      }
    };

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [validUntil]);

  // ── Computed state ─────────────────────────────────────────────────
  const isActive = !!keypair && !!sessionTokenPDA && remainingSeconds > 0;
  const isExpiring = isActive && remainingSeconds < EXPIRY_WARNING_SECONDS;

  const session: SessionKeyState = {
    isActive,
    keypair: isActive ? keypair : null,
    sessionTokenPDA: isActive ? sessionTokenPDA : null,
    remainingSeconds,
    isExpiring,
  };

  // ── Create session ─────────────────────────────────────────────────
  const createSession = useCallback(
    async (durationSeconds: number = SESSION_DURATION_SECONDS) => {
      if (!provider || !publicKey) {
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      setError(null);

      try {
        const connection = provider.connection;

        // 1. Generate ephemeral keypair
        const ephemeral = Keypair.generate();
        const now = Math.floor(Date.now() / 1000);
        const expiry = now + durationSeconds;

        // 2. Derive session token PDA
        const [pda] = getSessionTokenPDA(PROGRAM_ID, ephemeral.publicKey, publicKey);

        // 3. Build transaction:
        //    a) Create session token on-chain (with top-up to fund ephemeral key)
        //    b) Transfer SOL to ephemeral key for tx fees
        // Single instruction: creates session token PDA and auto-transfers
        // 0.01 SOL to the ephemeral key for tx fees (top_up: true)
        const tx = new Transaction();

        tx.add(
          buildCreateSessionInstruction(
            ephemeral.publicKey,
            publicKey,
            pda,
            expiry
          )
        );

        // 4. Sign with both the real wallet AND the ephemeral key
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey;

        // Partially sign with ephemeral key first
        tx.partialSign(ephemeral);

        // Then sign with wallet (this triggers the one popup)
        const signedTx = await provider.wallet.signTransaction(tx);
        const signature = await connection.sendRawTransaction(
          signedTx.serialize()
        );

        await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          "confirmed"
        );

        // 5. Store session
        setKeypair(ephemeral);
        setSessionTokenPDA(pda);
        setValidUntil(expiry);
        saveSession(ephemeral, pda, expiry, publicKey);

        console.log(
          "[SessionKey] Created session:",
          ephemeral.publicKey.toBase58(),
          "expires:",
          new Date(expiry * 1000).toISOString()
        );
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : "Failed to create session";
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [provider, publicKey]
  );

  // ── Revoke session ─────────────────────────────────────────────────
  const revokeSession = useCallback(async () => {
    if (!provider || !publicKey) return;

    setLoading(true);
    setError(null);

    try {
      // If we have a valid session token, revoke it on-chain to reclaim rent
      if (sessionTokenPDA) {
        const connection = provider.connection;
        const tx = new Transaction();
        tx.add(buildRevokeSessionInstruction(sessionTokenPDA, publicKey));

        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey;

        const signedTx = await provider.wallet.signTransaction(tx);
        const signature = await connection.sendRawTransaction(
          signedTx.serialize()
        );

        await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          "confirmed"
        );

        console.log("[SessionKey] Session revoked on-chain:", signature);
      }
    } catch (e: unknown) {
      // Revocation failure is non-critical — session will expire naturally
      console.warn("[SessionKey] On-chain revocation failed:", e);
    } finally {
      // Always clear local state regardless of on-chain success
      setKeypair(null);
      setSessionTokenPDA(null);
      setValidUntil(0);
      clearStoredSession();
      setLoading(false);
    }
  }, [provider, publicKey, sessionTokenPDA]);

  // ── Send with session key ──────────────────────────────────────────
  const sendWithSession = useCallback(
    async (tx: Transaction): Promise<string> => {
      if (!keypair || !sessionTokenPDA || remainingSeconds <= 0) {
        throw new Error("No active session — create a session first");
      }

      if (!provider) {
        throw new Error("Provider not available");
      }

      const connection = provider.connection;

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = keypair.publicKey;

      // Sign with the ephemeral key — no wallet popup
      tx.sign(keypair);

      const signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      return signature;
    },
    [keypair, sessionTokenPDA, remainingSeconds, provider]
  );

  return {
    session,
    createSession,
    revokeSession,
    sendWithSession,
    loading,
    error,
  };
}
