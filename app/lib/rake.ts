import { solToLamports } from "./utils";

/**
 * Platform rake schedule — automatically applied based on blind level.
 * Players don't choose rake; the platform sets it transparently.
 *
 * Structure mirrors industry standard:
 * - Lower stakes = higher % but lower cap
 * - Higher stakes = lower % but higher cap
 */
interface RakeTier {
  /** Maximum big blind (in lamports) for this tier. Infinity for the last tier. */
  maxBigBlind: number;
  /** Rake in basis points (e.g., 500 = 5%) */
  rakeBps: number;
  /** Maximum rake per hand in lamports (0 = no cap) */
  rakeCap: number;
  /** Human-readable label */
  label: string;
}

const RAKE_SCHEDULE: RakeTier[] = [
  {
    maxBigBlind: solToLamports(0.05),   // Micro stakes: up to 0.025/0.05 SOL
    rakeBps: 500,                        // 5%
    rakeCap: solToLamports(0.5),         // Capped at 0.5 SOL
    label: "Micro",
  },
  {
    maxBigBlind: solToLamports(0.5),    // Low stakes: up to 0.25/0.5 SOL
    rakeBps: 450,                        // 4.5%
    rakeCap: solToLamports(1),           // Capped at 1 SOL
    label: "Low",
  },
  {
    maxBigBlind: solToLamports(2),      // Medium stakes: up to 1/2 SOL
    rakeBps: 400,                        // 4%
    rakeCap: solToLamports(2),           // Capped at 2 SOL
    label: "Medium",
  },
  {
    maxBigBlind: solToLamports(10),     // High stakes: up to 5/10 SOL
    rakeBps: 300,                        // 3%
    rakeCap: solToLamports(5),           // Capped at 5 SOL
    label: "High",
  },
  {
    maxBigBlind: Infinity,              // Nosebleed: 10+ SOL
    rakeBps: 250,                        // 2.5%
    rakeCap: solToLamports(10),          // Capped at 10 SOL
    label: "Nosebleed",
  },
];

/**
 * Get the rake tier for a given big blind amount.
 */
export function getRakeTier(bigBlindLamports: number): RakeTier {
  for (const tier of RAKE_SCHEDULE) {
    if (bigBlindLamports <= tier.maxBigBlind) {
      return tier;
    }
  }
  return RAKE_SCHEDULE[RAKE_SCHEDULE.length - 1];
}

/**
 * Get rake parameters for a given big blind amount.
 * Used when creating a table — the frontend automatically
 * sets the rake based on stake level.
 */
export function getRakeForBlinds(bigBlindLamports: number): {
  rakeBps: number;
  rakeCap: number;
} {
  const tier = getRakeTier(bigBlindLamports);
  return {
    rakeBps: tier.rakeBps,
    rakeCap: tier.rakeCap,
  };
}

/**
 * Format rake info for display.
 */
export function formatRakeInfo(rakeBps: number, rakeCapLamports: number): string {
  const pct = (rakeBps / 100).toFixed(1).replace(/\.0$/, "");
  if (rakeCapLamports === 0) {
    return `${pct}%`;
  }
  const cap = (rakeCapLamports / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "");
  return `${pct}% (${cap} SOL cap)`;
}

/**
 * Full rake schedule for display on a "Rake Structure" page.
 */
export function getRakeSchedule() {
  return RAKE_SCHEDULE.map((tier) => ({
    label: tier.label,
    rakeBps: tier.rakeBps,
    rakeCap: tier.rakeCap,
    rakePercent: tier.rakeBps / 100,
  }));
}
