/* eslint-disable */
/**
 * HiddenHand — timeout_showdown emergency-abort test (devnet).
 *
 * Simulates a stuck showdown by driving a hand to the Showdown phase but NEVER
 * calling showdown_reveal (as if the reveal MPC were dead). Then:
 *   1. asserts timeout_showdown is rejected before REVEAL_TIMEOUT (TimeoutNotReached),
 *   2. waits out REVEAL_TIMEOUT_SECONDS (180s),
 *   3. asserts timeout_showdown succeeds, settles the hand, and REFUNDS every stake.
 *
 * Run from app/:  RPC_URL=<helius> node scripts/devnet-timeout-showdown.cjs
 */
const os = require("os");
const fs = require("fs");
const path = require("path");
const anchor = require("@anchor-lang/core");
const { Program, AnchorProvider, BN, Wallet } = anchor;
const { Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const splToken = require("@solana/spl-token");
const {
  x25519, RescueCipher, getMXEPublicKey, deserializeLE, awaitComputationFinalization,
  getArciumProgramId, getArciumSignerAccAddress, getMXEAccAddress, getMempoolAccAddress,
  getExecutingPoolAccAddress, getComputationAccAddress, getCompDefAccAddress, getCompDefAccOffset,
  getClusterAccAddress, getFeePoolAccAddress, getClockAccAddress,
} = require("@arcium-hq/client");
const { randomBytes } = require("crypto");

const CLUSTER_OFFSET = 456;
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const RPC = process.env.RPC_URL || "https://api.devnet.solana.com";
const WALLET_PATH = process.env.ANCHOR_WALLET || path.join(os.homedir(), ".config/solana/id.json");
const IDL = require(path.join(__dirname, "..", "lib", "idl", "hiddenhand.json"));
const PROGRAM_ID = new PublicKey(IDL.address);
const REVEAL_TIMEOUT_SECONDS = 180;

const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const loadKp = (p) => Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(p, "utf8"))));
const compDefOffset = (name) => Buffer.from(getCompDefAccOffset(name)).readUInt32LE(0);
const u64le = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
const tablePda = (id) => PublicKey.findProgramAddressSync([Buffer.from("table"), Buffer.from(id)], PROGRAM_ID)[0];
const seatPda = (t, i) => PublicKey.findProgramAddressSync([Buffer.from("seat"), t.toBuffer(), Buffer.from([i])], PROGRAM_ID)[0];
const handPda = (t, n) => PublicKey.findProgramAddressSync([Buffer.from("hand"), t.toBuffer(), u64le(n)], PROGRAM_ID)[0];
const deckPda = (t, n) => PublicKey.findProgramAddressSync([Buffer.from("deck"), t.toBuffer(), u64le(n)], PROGRAM_ID)[0];
const vaultPda = (t) => PublicKey.findProgramAddressSync([Buffer.from("vault"), t.toBuffer()], PROGRAM_ID)[0];
const newOffset = () => new BN(randomBytes(8), "le");
function arciumQueueAccounts(off, circuit) {
  return {
    signPdaAccount: getArciumSignerAccAddress(PROGRAM_ID), mxeAccount: getMXEAccAddress(PROGRAM_ID),
    mempoolAccount: getMempoolAccAddress(CLUSTER_OFFSET), executingPool: getExecutingPoolAccAddress(CLUSTER_OFFSET),
    computationAccount: getComputationAccAddress(CLUSTER_OFFSET, off), compDefAccount: getCompDefAccAddress(PROGRAM_ID, compDefOffset(circuit)),
    clusterAccount: getClusterAccAddress(CLUSTER_OFFSET), poolAccount: getFeePoolAccAddress(), clockAccount: getClockAccAddress(),
    arciumProgram: getArciumProgramId(),
  };
}
function programFor(connection, kp) {
  const provider = new AnchorProvider(connection, new Wallet(kp), { commitment: "confirmed", preflightCommitment: "confirmed" });
  return { provider, program: new Program(IDL, provider) };
}
const fails = [];
async function expectReject(label, expected, thunk) {
  try { await thunk(); log(`  ✗ ${label}: succeeded but expected rejection ${expected}`); fails.push(label); }
  catch (e) {
    const blob = `${e?.message || ""} | ${(e?.logs || []).join(" ")} | ${e?.toString?.() || ""}`;
    if (blob.includes(expected)) log(`  ✓ ${label}: correctly rejected (${expected})`);
    else { log(`  ✗ ${label}: wrong error, wanted ${expected}: ${(e?.message || "").slice(0, 160)}`); fails.push(label); }
  }
}

async function main() {
  log(`\n=== timeout_showdown emergency-abort test (devnet) ===`);
  const fetchWithRetry = async (url, opts) => { let le; for (let i = 0; i < 6; i++) { try { return await fetch(url, opts); } catch (e) { le = e; await sleep(400 * (i + 1)); } } throw le; };
  const connection = new Connection(RPC, { commitment: "confirmed", fetch: fetchWithRetry });
  const authority = loadKp(WALLET_PATH);
  const { provider, program } = programFor(connection, authority);
  log(`Program ${PROGRAM_ID.toBase58()}  authority ${authority.publicKey.toBase58().slice(0, 6)}…`);
  let mxePub = null;
  for (let i = 0; i < 30 && !mxePub; i++) { mxePub = await getMXEPublicKey(provider, PROGRAM_ID).catch(() => null); if (!mxePub) await sleep(1000); }
  if (!mxePub) throw new Error("MXE key unavailable");

  // setup
  const mint = await splToken.createMint(connection, authority, authority.publicKey, null, 6);
  const players = [Keypair.generate(), Keypair.generate()];
  for (const p of players) {
    await provider.sendAndConfirm(new Transaction().add(SystemProgram.transfer({ fromPubkey: authority.publicKey, toPubkey: p.publicKey, lamports: 0.3 * LAMPORTS_PER_SOL })), [authority]);
    const ata = await splToken.getOrCreateAssociatedTokenAccount(connection, authority, mint, p.publicKey);
    await splToken.mintTo(connection, authority, mint, ata.address, authority, 1_000_000_000);
  }
  const tableId = Array.from(randomBytes(32));
  const tPda = tablePda(tableId);
  await program.methods.createTable(tableId, new BN(1_000_000), new BN(2_000_000), new BN(50_000_000), new BN(500_000_000), 6, 0, new BN(0))
    .accounts({ authority: authority.publicKey, table: tPda, mint, vault: vaultPda(tPda), tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).rpc({ commitment: "confirmed" });
  const x25 = players.map(() => { const sk = x25519.utils.randomSecretKey(); return { sk, pk: x25519.getPublicKey(sk) }; });
  for (let i = 0; i < 2; i++) {
    const { program: pProg } = programFor(connection, players[i]);
    await pProg.methods.joinTable(i, new BN(200_000_000)).accounts({ player: players[i].publicKey, table: tPda, playerSeat: seatPda(tPda, i), playerTokenAccount: splToken.getAssociatedTokenAddressSync(mint, players[i].publicKey), vault: vaultPda(tPda), mint, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).remainingAccounts(i === 0 ? [] : [{ pubkey: seatPda(tPda, 0), isSigner: false, isWritable: false }]).rpc({ commitment: "confirmed" });
  }
  const table = await program.account.table.fetch(tPda);
  const handNo = table.handNumber.toNumber() + 1;
  const hPda = handPda(tPda, handNo), dPda = deckPda(tPda, handNo);
  await program.methods.startHand().accounts({ caller: authority.publicKey, table: tPda, handState: hPda, deckState: dPda, systemProgram: SystemProgram.programId }).remainingAccounts([0, 1].map((i) => ({ pubkey: seatPda(tPda, i), isSigner: false, isWritable: false }))).rpc({ commitment: "confirmed" });
  let off = newOffset();
  await program.methods.shuffle(off).accountsPartial({ payer: authority.publicKey, ...arciumQueueAccounts(off, "shuffle"), table: tPda, handState: hPda, deckState: dPda }).rpc({ skipPreflight: true, commitment: "confirmed" });
  await awaitComputationFinalization(provider, off, PROGRAM_ID, "confirmed");
  for (let i = 0; i < 2; i++) {
    const { program: pProg, provider: pProv } = programFor(connection, players[i]);
    off = newOffset();
    await pProg.methods.dealToSeat(off, i, Array.from(x25[i].pk), new BN(deserializeLE(randomBytes(16)).toString())).accountsPartial({ payer: players[i].publicKey, ...arciumQueueAccounts(off, "deal_to_seat_v2"), table: tPda, handState: hPda, deckState: dPda, playerSeat: seatPda(tPda, i) }).rpc({ skipPreflight: true, commitment: "confirmed" });
    await awaitComputationFinalization(pProv, off, PROGRAM_ID, "confirmed");
  }
  log(`  hand set up and dealt`);

  // drive betting to Showdown (both check/call, no fold) — but DO NOT call showdown_reveal
  async function seatBet(i) { return (await program.account.playerSeat.fetch(seatPda(tPda, i))).currentBet; }
  async function driveBetting() {
    for (let g = 0; g < 20; g++) {
      const hs = await program.account.handState.fetch(hPda);
      const phase = Object.keys(hs.phase)[0];
      if (hs.awaitingCommunityReveal || phase === "showdown" || phase === "settled") return hs;
      const seat = hs.actionOn; const { program: pProg } = programFor(connection, players[seat]);
      const toCall = hs.currentBet.sub(await seatBet(seat));
      await pProg.methods.playerAction(toCall.gtn(0) ? { call: {} } : { check: {} }).accountsPartial({ signer: players[seat].publicKey, table: tPda, handState: hPda, deckState: dPda, playerSeat: seatPda(tPda, seat), sessionToken: null }).rpc({ commitment: "confirmed" });
      await sleep(400);
    }
    throw new Error("betting guard");
  }
  async function revealStreet(circuit, method) {
    off = newOffset();
    await program.methods[method](off).accountsPartial({ payer: authority.publicKey, caller: authority.publicKey, ...arciumQueueAccounts(off, circuit), table: tPda, handState: hPda, deckState: dPda, sessionToken: null }).rpc({ skipPreflight: true, commitment: "confirmed" });
    await awaitComputationFinalization(provider, off, PROGRAM_ID, "confirmed");
  }
  let hs = await driveBetting();
  if (hs.awaitingCommunityReveal) { await revealStreet("reveal_flop", "revealFlop"); hs = await driveBetting(); }
  if (hs.awaitingCommunityReveal) { await revealStreet("reveal_turn", "revealTurn"); hs = await driveBetting(); }
  if (hs.awaitingCommunityReveal) { await revealStreet("reveal_river", "revealRiver"); hs = await driveBetting(); }
  const phaseNow = Object.keys((await program.account.handState.fetch(hPda)).phase)[0];
  log(`  phase now: ${phaseNow} (showdown_reveal intentionally NOT called → stuck)`);
  if (phaseNow !== "showdown") throw new Error(`expected showdown, got ${phaseNow}`);

  const seatMetas = [0, 1].map((i) => ({ pubkey: seatPda(tPda, i), isSigner: false, isWritable: true }));

  // 1. too early → TimeoutNotReached
  log(`\n--- timeout_showdown checks ---`);
  await expectReject("early timeout_showdown", "TimeoutNotReached", () =>
    program.methods.timeoutShowdown().accounts({ caller: authority.publicKey, table: tPda, handState: hPda }).remainingAccounts(seatMetas).rpc({ commitment: "confirmed" }));

  // 2. wait out the reveal timeout
  const potStuck = (await program.account.handState.fetch(hPda)).pot.toString();
  const chipsBefore = [];
  for (let i = 0; i < 2; i++) chipsBefore.push((await program.account.playerSeat.fetch(seatPda(tPda, i))).chips.toString());
  log(`  stuck at showdown: pot ${potStuck}, chips [${chipsBefore}]. waiting ${REVEAL_TIMEOUT_SECONDS + 8}s for the reveal timeout…`);
  await sleep((REVEAL_TIMEOUT_SECONDS + 8) * 1000);

  // 3. abort → success, refund everyone
  await program.methods.timeoutShowdown().accounts({ caller: authority.publicKey, table: tPda, handState: hPda }).remainingAccounts(seatMetas).rpc({ commitment: "confirmed" });
  const done = await program.account.handState.fetch(hPda);
  const doneTable = await program.account.table.fetch(tPda);
  const chipsAfter = [];
  for (let i = 0; i < 2; i++) chipsAfter.push((await program.account.playerSeat.fetch(seatPda(tPda, i))).chips.toString());
  const bothRefunded = chipsAfter.every((c) => c === "200000000");
  const settled = Object.keys(done.phase)[0] === "settled" && done.pot.toString() === "0" && Object.keys(doneTable.status)[0] === "waiting";
  log(`  after abort: phase ${Object.keys(done.phase)[0]}, pot ${done.pot}, table ${Object.keys(doneTable.status)[0]}, chips [${chipsAfter}]`);
  log(`  ${bothRefunded ? "✓" : "✗"} every stake refunded to 200000000 buy-in`);
  log(`  ${settled ? "✓" : "✗"} hand settled and table returned to Waiting`);
  if (!bothRefunded) fails.push("refund");
  if (!settled) fails.push("settle");

  log(`\n=== VERDICT ===`);
  if (fails.length === 0) log(`✓ timeout_showdown: rejected before the timeout, then aborted the stuck hand and refunded all stakes.`);
  else { log(`✗ ${fails.length} check(s) FAILED: ${fails.join(", ")}`); process.exitCode = 1; }
}
main().then(() => process.exit(process.exitCode || 0)).catch((e) => { console.error("\nFATAL:", e); if (e.logs) console.error(e.logs.join("\n")); process.exit(1); });
