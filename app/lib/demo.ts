/**
 * Pinned table the landing "Watch live" CTA and the crank both target.
 *
 * On-chain `table_id` is this UTF-8 string copied into a 32-byte array and
 * zero-padded (same as `generateTableId` in `program.ts`). The crank at
 * `app/scripts/demo-crank.cjs` hardcodes the same string — keep them in lockstep.
 */
export const DEMO_TABLE_ID = "judge-demo";
