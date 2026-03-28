import { displayToBaseUnits, formatTokenAmount, getDefaultToken, type TokenInfo } from "./tokens";

/**
 * Platform rake schedule — automatically applied based on blind level.
 * Players don't choose rake; the platform sets it transparently.
 *
 * Structure mirrors industry standard:
 * - Lower stakes = higher % but lower cap
 * - Higher stakes = lower % but higher cap
 *
 * All amounts are in USDC base units (6 decimals, 1 USDC = 1_000_000).
 */
interface RakeTier {
  /** Maximum big blind (in base units) for this tier. Infinity for the last tier. */
  maxBigBlind: number;
  /** Rake in basis points (e.g., 500 = 5%) */
  rakeBps: number;
  /** Maximum rake per hand in base units (0 = no cap) */
  rakeCap: number;
  /** Human-readable label */
  label: string;
}

const USDC = getDefaultToken();

const RAKE_SCHEDULE: RakeTier[] = [
  {
    maxBigBlind: displayToBaseUnits(0.10, USDC),   // Micro stakes: up to $0.05/$0.10
    rakeBps: 500,                                    // 5%
    rakeCap: displayToBaseUnits(1, USDC),            // Capped at $1
    label: "Micro",
  },
  {
    maxBigBlind: displayToBaseUnits(1, USDC),       // Low stakes: up to $0.50/$1
    rakeBps: 450,                                    // 4.5%
    rakeCap: displayToBaseUnits(2, USDC),            // Capped at $2
    label: "Low",
  },
  {
    maxBigBlind: displayToBaseUnits(5, USDC),       // Medium stakes: up to $2.50/$5
    rakeBps: 400,                                    // 4%
    rakeCap: displayToBaseUnits(5, USDC),            // Capped at $5
    label: "Medium",
  },
  {
    maxBigBlind: displayToBaseUnits(25, USDC),      // High stakes: up to $12.50/$25
    rakeBps: 300,                                    // 3%
    rakeCap: displayToBaseUnits(15, USDC),           // Capped at $15
    label: "High",
  },
  {
    maxBigBlind: Infinity,                           // Nosebleed: $25+
    rakeBps: 250,                                    // 2.5%
    rakeCap: displayToBaseUnits(25, USDC),           // Capped at $25
    label: "Nosebleed",
  },
];

/**
 * Get the rake tier for a given big blind amount.
 */
export function getRakeTier(bigBlindBaseUnits: number): RakeTier {
  for (const tier of RAKE_SCHEDULE) {
    if (bigBlindBaseUnits <= tier.maxBigBlind) {
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
export function getRakeForBlinds(bigBlindBaseUnits: number): {
  rakeBps: number;
  rakeCap: number;
} {
  const tier = getRakeTier(bigBlindBaseUnits);
  return {
    rakeBps: tier.rakeBps,
    rakeCap: tier.rakeCap,
  };
}

/**
 * Format rake info for display.
 */
export function formatRakeInfo(rakeBps: number, rakeCapBaseUnits: number, token?: TokenInfo): string {
  const t = token ?? USDC;
  const pct = (rakeBps / 100).toFixed(1).replace(/\.0$/, "");
  if (rakeCapBaseUnits === 0) {
    return `${pct}%`;
  }
  return `${pct}% (${formatTokenAmount(rakeCapBaseUnits, t)} cap)`;
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
