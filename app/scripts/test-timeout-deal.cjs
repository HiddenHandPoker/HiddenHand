/* eslint-disable */
/**
 * Focused devnet test for the timeout_deal AFK-recovery instruction.
 *   setup → start_hand → shuffle → deal ONLY seat 0 (posts a blind) → wait out
 *   DEAL_TIMEOUT → timeout_deal → assert: table Waiting, hand Settled, pot 0,
 *   seat 0's posted blind refunded, both seats reset to Sitting.
 * Run from app/:  RPC_URL=<helius> node scripts/test-timeout-deal.cjs
 */
const os = require("os"), fs = require("fs"), path = require("path");
const anchor = require("@anchor-lang/core");
const { Program, AnchorProvider, BN, Wallet } = anchor;
const { Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const spl = require("@solana/spl-token");
const {
  x25519, deserializeLE, awaitComputationFinalization, getArciumSignerAccAddress,
  getMXEAccAddress, getMempoolAccAddress, getExecutingPoolAccAddress, getComputationAccAddress,
  getCompDefAccAddress, getCompDefAccOffset, getClusterAccAddress, getFeePoolAccAddress,
  getClockAccAddress, getArciumProgramId,
} = require("@arcium-hq/client");
const { randomBytes } = require("crypto");

const CLUSTER_OFFSET = 456;
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const RPC = process.env.RPC_URL || "https://api.devnet.solana.com";
const IDL = require(path.join(__dirname, "..", "lib", "idl", "hiddenhand.json"));
const PROGRAM_ID = new PublicKey(IDL.address);
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const u64le = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
const cdOff = (n) => Buffer.from(getCompDefAccOffset(n)).readUInt32LE(0);
const tablePda = (id) => PublicKey.findProgramAddressSync([Buffer.from("table"), Buffer.from(id)], PROGRAM_ID)[0];
const seatPda = (t, i) => PublicKey.findProgramAddressSync([Buffer.from("seat"), t.toBuffer(), Buffer.from([i])], PROGRAM_ID)[0];
const handPda = (t, n) => PublicKey.findProgramAddressSync([Buffer.from("hand"), t.toBuffer(), u64le(n)], PROGRAM_ID)[0];
const deckPda = (t, n) => PublicKey.findProgramAddressSync([Buffer.from("deck"), t.toBuffer(), u64le(n)], PROGRAM_ID)[0];
const vaultPda = (t) => PublicKey.findProgramAddressSync([Buffer.from("vault"), t.toBuffer()], PROGRAM_ID)[0];
const newOffset = () => new BN(randomBytes(8), "le");
function arc(off, name) {
  return {
    signPdaAccount: getArciumSignerAccAddress(PROGRAM_ID), mxeAccount: getMXEAccAddress(PROGRAM_ID),
    mempoolAccount: getMempoolAccAddress(CLUSTER_OFFSET), executingPool: getExecutingPoolAccAddress(CLUSTER_OFFSET),
    computationAccount: getComputationAccAddress(CLUSTER_OFFSET, off), compDefAccount: getCompDefAccAddress(PROGRAM_ID, cdOff(name)),
    clusterAccount: getClusterAccAddress(CLUSTER_OFFSET), poolAccount: getFeePoolAccAddress(),
    clockAccount: getClockAccAddress(), arciumProgram: getArciumProgramId(),
  };
}
function programFor(conn, kp) {
  const provider = new AnchorProvider(conn, new Wallet(kp), { commitment: "confirmed" });
  return { provider, program: new Program(IDL, provider) };
}

async function main() {
  const fetchWithRetry = async (u, o) => { let e; for (let i = 0; i < 8; i++) { try { const r = await fetch(u, o); if (r.status >= 500 || r.status === 429) { e = new Error(`${r.status}`); await sleep(600 * (i + 1)); continue; } return r; } catch (x) { e = x; await sleep(600 * (i + 1)); } } throw e; };
  const connection = new Connection(RPC, { commitment: "confirmed", fetch: fetchWithRetry });
  const authority = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(path.join(os.homedir(), ".config/solana/id.json"), "utf8"))));
  const { provider, program } = programFor(connection, authority);
  log("=== timeout_deal devnet test ===");

  // setup
  const mint = await spl.createMint(connection, authority, authority.publicKey, null, 6);
  const players = [Keypair.generate(), Keypair.generate()];
  for (const p of players) {
    await provider.sendAndConfirm(new Transaction().add(SystemProgram.transfer({ fromPubkey: authority.publicKey, toPubkey: p.publicKey, lamports: 0.35 * LAMPORTS_PER_SOL })), [authority]);
    const ata = await spl.getOrCreateAssociatedTokenAccount(connection, authority, mint, p.publicKey);
    await spl.mintTo(connection, authority, mint, ata.address, authority, 1_000_000_000);
  }
  const tableId = Array.from(randomBytes(32));
  const tPda = tablePda(tableId);
  await program.methods.createTable(tableId, new BN(1_000_000), new BN(2_000_000), new BN(50_000_000), new BN(500_000_000), 6, 0, new BN(0))
    .accounts({ authority: authority.publicKey, table: tPda, mint, vault: vaultPda(tPda), tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).rpc({ commitment: "confirmed" });
  for (let i = 0; i < 2; i++) {
    const { program: pp } = programFor(connection, players[i]);
    await pp.methods.joinTable(i, new BN(200_000_000)).accounts({ player: players[i].publicKey, table: tPda, playerSeat: seatPda(tPda, i), playerTokenAccount: spl.getAssociatedTokenAddressSync(mint, players[i].publicKey), vault: vaultPda(tPda), mint, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).rpc({ commitment: "confirmed" });
  }
  const table = await program.account.table.fetch(tPda);
  const hn = table.handNumber.toNumber() + 1;
  const hPda = handPda(tPda, hn), dPda = deckPda(tPda, hn);
  await program.methods.startHand().accounts({ caller: authority.publicKey, table: tPda, handState: hPda, deckState: dPda, systemProgram: SystemProgram.programId }).rpc({ commitment: "confirmed" });
  log("hand started");

  // shuffle
  let off = newOffset();
  await program.methods.shuffle(off).accountsPartial({ payer: authority.publicKey, ...arc(off, "shuffle"), table: tPda, handState: hPda, deckState: dPda }).rpc({ skipPreflight: true, commitment: "confirmed" });
  await awaitComputationFinalization(provider, off, PROGRAM_ID, "confirmed");
  log("deck shuffled");

  // deal ONLY seat 0 (posts its blind). Seat 1 stays AFK.
  const sk = x25519.utils.randomSecretKey();
  const { program: p0 } = programFor(connection, players[0]);
  off = newOffset();
  await p0.methods.dealToSeat(off, 0, Array.from(x25519.getPublicKey(sk)), new BN(deserializeLE(randomBytes(16)).toString()))
    .accountsPartial({ payer: players[0].publicKey, ...arc(off, "deal_to_seat"), table: tPda, handState: hPda, deckState: dPda, playerSeat: seatPda(tPda, 0) }).rpc({ skipPreflight: true, commitment: "confirmed" });
  await awaitComputationFinalization(provider, off, PROGRAM_ID, "confirmed");
  const seat0Before = await program.account.playerSeat.fetch(seatPda(tPda, 0));
  const handBefore = await program.account.handState.fetch(hPda);
  log(`seat 0 dealt in — chips=${seat0Before.chips} bet=${seat0Before.totalBetThisHand} | pot=${handBefore.pot} dealt=${handBefore.dealtPlayers} active=${handBefore.activePlayers}`);

  // wait out the deal timeout (30s) + buffer
  log("waiting 38s for deal timeout…");
  await sleep(38_000);

  // anyone calls timeout_deal
  const seatMetas = [0, 1].map((i) => ({ pubkey: seatPda(tPda, i), isSigner: false, isWritable: true }));
  await program.methods.timeoutDeal().accounts({ caller: authority.publicKey, table: tPda, handState: hPda, deckState: dPda }).remainingAccounts(seatMetas).rpc({ commitment: "confirmed" });
  log("timeout_deal called");

  // assertions
  const tAfter = await program.account.table.fetch(tPda);
  const hAfter = await program.account.handState.fetch(hPda);
  const s0 = await program.account.playerSeat.fetch(seatPda(tPda, 0));
  const s1 = await program.account.playerSeat.fetch(seatPda(tPda, 1));
  const ok = (label, cond) => log(`  ${cond ? "✓" : "✗"} ${label}`);
  log("--- results ---");
  ok("table back to Waiting", Object.keys(tAfter.status)[0] === "waiting");
  ok("hand phase Settled", Object.keys(hAfter.phase)[0] === "settled");
  ok("pot reset to 0", hAfter.pot.toNumber() === 0);
  ok(`seat 0 blind refunded (chips ${s0.chips} == 200000000)`, s0.chips.toNumber() === 200_000_000);
  ok("seat 0 bet reset to 0", s0.totalBetThisHand.toNumber() === 0);
  ok("seat 0 status Sitting", Object.keys(s0.status)[0] === "sitting");
  ok("seat 1 status Sitting", Object.keys(s1.status)[0] === "sitting");
  log("\n=== DONE ===");
}
main().then(() => process.exit(0)).catch((e) => { console.error("FAILED:", e.message); if (e.logs) console.error(e.logs.join("\n")); process.exit(1); });
