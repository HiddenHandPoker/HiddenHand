import { NextRequest, NextResponse } from "next/server";
import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import bs58 from "bs58";
import { FAUCET_TOKEN } from "@/lib/tokens";

// Node runtime: @solana/spl-token uses node crypto (not Edge-compatible).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Chips handed out per request (whole tokens).
const FAUCET_AMOUNT = 2000;
// Light per-wallet cooldown (best-effort; resets on cold start — fine for devnet).
const COOLDOWN_MS = 60_000;
const lastRequest = new Map<string, number>();

function faucetKeypair(): Keypair {
  const secret = process.env.FAUCET_SECRET;
  if (!secret) throw new Error("FAUCET_SECRET not configured");
  // Accept either a base58 string or a JSON array of bytes.
  const bytes = secret.trim().startsWith("[")
    ? Uint8Array.from(JSON.parse(secret))
    : bs58.decode(secret.trim());
  return Keypair.fromSecretKey(bytes);
}

function rpcUrl(): string {
  return (
    process.env.FAUCET_RPC ||
    process.env.NEXT_PUBLIC_SOLANA_RPC ||
    clusterApiUrl("devnet")
  );
}

export async function POST(req: NextRequest) {
  try {
    const { wallet } = await req.json();
    let owner: PublicKey;
    try {
      owner = new PublicKey(wallet);
    } catch {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    const key = owner.toBase58();
    const now = Date.now();
    const prev = lastRequest.get(key);
    if (prev && now - prev < COOLDOWN_MS) {
      const wait = Math.ceil((COOLDOWN_MS - (now - prev)) / 1000);
      return NextResponse.json(
        { error: `Please wait ${wait}s before requesting more chips.` },
        { status: 429 }
      );
    }

    const connection = new Connection(rpcUrl(), "confirmed");
    const faucet = faucetKeypair();
    const mint = FAUCET_TOKEN.mint;

    // Faucet pays for the ATA (if new) and signs the mint.
    const ata = await getOrCreateAssociatedTokenAccount(connection, faucet, mint, owner);
    const amount = FAUCET_AMOUNT * FAUCET_TOKEN.baseUnitsPerToken;
    const signature = await mintTo(connection, faucet, mint, ata.address, faucet, amount);
    lastRequest.set(key, now); // start cooldown only after a successful mint

    return NextResponse.json({
      signature,
      amount: FAUCET_AMOUNT,
      symbol: FAUCET_TOKEN.symbol,
      mint: mint.toBase58(),
      tokenAccount: ata.address.toBase58(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Faucet error";
    // Don't let a failure permanently lock a wallet out of retrying.
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
