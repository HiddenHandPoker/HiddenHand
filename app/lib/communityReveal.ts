/**
 * Auto-reveal gate. All-in runout keeps `awaiting_community_reveal` true
 * across flop→turn→river, so the in-flight lock must drop after EACH street's
 * MPC callback — not stay held for the whole runout.
 */
export function nextCommunityRevealAllowed(opts: {
  awaiting: boolean;
  inFlight: boolean;
  revealingUi: boolean;
  phase: string;
}): boolean {
  if (!opts.awaiting || opts.inFlight || opts.revealingUi) return false;
  return opts.phase === "PreFlop" || opts.phase === "Flop" || opts.phase === "Turn";
}
