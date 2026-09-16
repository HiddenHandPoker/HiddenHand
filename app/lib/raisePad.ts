export type RaisePresetId = "half" | "twoThirds" | "pot" | "allin";

export const RAISE_PRESETS: { id: RaisePresetId; label: string }[] = [
  { id: "half", label: "½ pot" },
  { id: "twoThirds", label: "⅔ pot" },
  { id: "pot", label: "pot" },
  { id: "allin", label: "all-in" },
];

/**
 * Chips to put in this action for a pot-fraction raise.
 * Standard pot-sized formula: toCall + fraction * (pot + toCall).
 * When toCall is 0 this is just fraction * pot.
 */
export function potFractionChips(fraction: number, pot: number, toCall: number): number {
  const p = Number.isFinite(pot) && pot > 0 ? pot : 0;
  const call = Number.isFinite(toCall) && toCall > 0 ? toCall : 0;
  const f = Number.isFinite(fraction) && fraction > 0 ? fraction : 0;
  return Math.floor(call + f * (p + call));
}

export function raisePresetValue(
  id: RaisePresetId,
  pot: number,
  toCall: number,
  playerChips: number,
): number {
  if (id === "allin") return Math.max(0, playerChips);
  const fraction = id === "half" ? 0.5 : id === "twoThirds" ? 2 / 3 : 1;
  return Math.min(Math.max(0, playerChips), potFractionChips(fraction, pot, toCall));
}

/**
 * Disable ½ / ⅔ / pot when the resulting raise increment is below on-chain
 * minRaise. All-in stays enabled — Action::AllIn is legal when short.
 */
export function raisePresetDisabled(
  id: RaisePresetId,
  value: number,
  toCall: number,
  minRaise: number,
  playerChips: number,
): boolean {
  if (playerChips <= toCall) return true;
  if (id === "allin") return false;
  return value - toCall < minRaise;
}
