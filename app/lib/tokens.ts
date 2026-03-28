import { PublicKey } from "@solana/web3.js";

/**
 * Supported token definitions for poker tables.
 * Each table is denominated in a single token — players must use that token to buy in.
 */
export interface TokenInfo {
  /** Token mint address */
  mint: PublicKey;
  /** Human-readable name */
  name: string;
  /** Short symbol (e.g. "USDC") */
  symbol: string;
  /** Number of decimals (e.g. 6 for USDC, 9 for SOL) */
  decimals: number;
  /** Base units per 1 whole token (e.g. 1_000_000 for USDC) */
  baseUnitsPerToken: number;
}

// USDC on Solana Devnet (Circle test token)
export const USDC_DEVNET: TokenInfo = {
  mint: new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
  name: "USD Coin (Devnet)",
  symbol: "USDC",
  decimals: 6,
  baseUnitsPerToken: 1_000_000,
};

// USDC on Solana Mainnet
export const USDC_MAINNET: TokenInfo = {
  mint: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
  name: "USD Coin",
  symbol: "USDC",
  decimals: 6,
  baseUnitsPerToken: 1_000_000,
};

/** All supported tokens, keyed by mint address string */
export const SUPPORTED_TOKENS: Record<string, TokenInfo> = {
  [USDC_DEVNET.mint.toBase58()]: USDC_DEVNET,
  [USDC_MAINNET.mint.toBase58()]: USDC_MAINNET,
};

/**
 * Get the default token for the current network.
 * For devnet, use devnet USDC. For mainnet, use mainnet USDC.
 */
export function getDefaultToken(cluster: "devnet" | "mainnet-beta" = "devnet"): TokenInfo {
  return cluster === "mainnet-beta" ? USDC_MAINNET : USDC_DEVNET;
}

/**
 * Look up token info by mint address. Returns undefined for unknown tokens.
 */
export function getTokenByMint(mint: PublicKey | string): TokenInfo | undefined {
  const key = typeof mint === "string" ? mint : mint.toBase58();
  return SUPPORTED_TOKENS[key];
}

/**
 * Convert base units to display amount for a given token.
 * e.g. 1_500_000 USDC base units → 1.5
 */
export function baseUnitsToDisplay(baseUnits: number, token: TokenInfo): number {
  return baseUnits / token.baseUnitsPerToken;
}

/**
 * Convert display amount to base units for a given token.
 * e.g. 1.5 USDC → 1_500_000
 */
export function displayToBaseUnits(display: number, token: TokenInfo): number {
  return Math.floor(display * token.baseUnitsPerToken);
}

/**
 * Format a token amount for display (e.g. "1.50 USDC").
 * Uses 2 decimal places by default for USDC, 4 for higher-decimal tokens.
 */
export function formatTokenAmount(
  baseUnits: number,
  token: TokenInfo,
  decimals?: number,
): string {
  const displayDecimals = decimals ?? (token.decimals <= 6 ? 2 : 4);
  const amount = baseUnitsToDisplay(baseUnits, token);
  return `${amount.toFixed(displayDecimals)} ${token.symbol}`;
}

/** SPL Token Program ID */
export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
