/* eslint-disable */
/**
 * HiddenHand — Arcium MPC full-hand integration test (devnet).
 *
 * Proves the whole card lifecycle on the deployed program:
 *   init 6 comp-defs → create table → join×2 → start_hand → shuffle(MPC)
 *   → deal_to_seat×2(MPC, decrypt) → betting → reveal_flop/turn/river(MPC)
 *   → showdown_reveal(MPC) → showdown.
 *
 * Run from app/:  node scripts/devnet-full-hand.cjs
 * Env: RPC_URL (Helius devnet), ANCHOR_WALLET (defaults ~/.config/solana/id.json)
 *
 * CommonJS on purpose: `require('@arcium-hq/client')` resolves the .cjs build,
 * which pulls @anchor-lang/core's CJS (default export intact) — sidestepping the
 * ESM default-export / browser-polyfill issues that only bite the Turbopack bundle.
 */
const os = require("os");
const fs = require("fs");
const path = require("path");
const anchor = require("@anchor-lang/core");
const { Program, AnchorProvider, BN, Wallet } = anchor;
const {
  Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL,
} = require("@solana/web3.js");
const splToken = require("@solana/spl-token");
const {
  x25519, RescueCipher, getMXEPublicKey, deserializeLE,
  awaitComputationFinalization, buildFinalizeCompDefTx,
  getArciumProgram, getArciumProgramId, getArciumSignerAccAddress,
  getMXEAccAddress, getMempoolAccAddress, getExecutingPoolAccAddress,
  getComputationAccAddress, getCompDefAccAddress, getCompDefAccOffset,
  getClusterAccAddress, getFeePoolAccAddress, getClockAccAddress,
  getLookupTableAddress,
} = require("@arcium-hq/client");

const { randomBytes } = require("crypto");

// ---------- config ----------
const CLUSTER_OFFSET = 456;
const LUT_PROGRAM_ID = new PublicKey("AddressLookupTab1e1111111111111111111111111");
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const RPC = process.env.RPC_URL || "https://api.devnet.solana.com";
const WALLET_PATH = process.env.ANCHOR_WALLET || path.join(os.homedir(), ".config/solana/id.json");
const IDL = require(path.join(__dirname, "..", "lib", "idl", "hiddenhand.json"));
const PROGRAM_ID = new PublicKey(IDL.address);

const CIRCUITS = ["shuffle", "deal_to_seat", "reveal_flop", "reveal_turn", "reveal_river", "showdown_reveal"];
const INIT_METHOD = {
  shuffle: "initShuffleCompDef",
  deal_to_seat: "initDealToSeatCompDef",
  reveal_flop: "initRevealFlopCompDef",
  reveal_turn: "initRevealTurnCompDef",
  reveal_river: "initRevealRiverCompDef",
  showdown_reveal: "initShowdownRevealCompDef",
};

// ---------- helpers ----------
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const loadKp = (p) => Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(p, "utf8"))));
const compDefOffset = (name) => Buffer.from(getCompDefAccOffset(name)).readUInt32LE(0);

// PDAs (mirror app/lib/program.ts)
const enc = new TextEncoder();
const u64le = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
const tablePda = (id) => PublicKey.findProgramAddressSync([Buffer.from("table"), Buffer.from(id)], PROGRAM_ID)[0];
const seatPda = (t, i) => PublicKey.findProgramAddressSync([Buffer.from("seat"), t.toBuffer(), Buffer.from([i])], PROGRAM_ID)[0];
const handPda = (t, n) => PublicKey.findProgramAddressSync([Buffer.from("hand"), t.toBuffer(), u64le(n)], PROGRAM_ID)[0];
const deckPda = (t, n) => PublicKey.findProgramAddressSync([Buffer.from("deck"), t.toBuffer(), u64le(n)], PROGRAM_ID)[0];
const vaultPda = (t) => PublicKey.findProgramAddressSync([Buffer.from("vault"), t.toBuffer()], PROGRAM_ID)[0];

function arciumQueueAccounts(computationOffset, circuitName) {
  return {
    signPdaAccount: getArciumSignerAccAddress(PROGRAM_ID),
    mxeAccount: getMXEAccAddress(PROGRAM_ID),
    mempoolAccount: getMempoolAccAddress(CLUSTER_OFFSET),
    executingPool: getExecutingPoolAccAddress(CLUSTER_OFFSET),
    computationAccount: getComputationAccAddress(CLUSTER_OFFSET, computationOffset),
    compDefAccount: getCompDefAccAddress(PROGRAM_ID, compDefOffset(circuitName)),
    clusterAccount: getClusterAccAddress(CLUSTER_OFFSET),
    poolAccount: getFeePoolAccAddress(),
    clockAccount: getClockAccAddress(),
    arciumProgram: getArciumProgramId(),
  };
}
const newOffset = () => new BN(randomBytes(8), "le");

function programFor(connection, kp) {
  const provider = new AnchorProvider(connection, new Wallet(kp), { commitment: "confirmed", preflightCommitment: "confirmed" });
  return { provider, program: new Program(IDL, provider) };
}

// decode program events from a tx's logs
async function eventsFromSig(connection, program, sig) {
  const tx = await connection.getTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
  const out = [];
  for (const l of (tx?.meta?.logMessages || [])) {
    const P = "Program data: ";
    if (!l.startsWith(P)) continue;
    try { const d = program.coder.events.decode(l.slice(P.length)); if (d) out.push(d); } catch {}
  }
  return out;
}

// Arcium submits the callback (which emits HoleDealt) as its own tx, and often a
// duplicate that fails with AlreadyCallbackedComputation(6204). awaitComputationFinalization
// may return either sig — so scan recent program txs for the holeDealt event
// addressed to our x25519 key rather than trusting one sig.
async function findHoleDealt(connection, program, myPubHex) {
  const sigs = await connection.getSignaturesForAddress(PROGRAM_ID, { limit: 15 });
  for (const s of sigs) {
    for (const ev of await eventsFromSig(connection, program, s.signature)) {
      if (ev.name !== "holeDealt" && ev.name !== "HoleDealt") continue;
      const d = ev.data;
      const encPubkey = d.encPubkey ?? d.enc_pubkey ?? [];
      if (Buffer.from(encPubkey).toString("hex") === myPubHex) return d;
    }
  }
  return null;
}

async function main() {
  log(`\n=== HiddenHand Arcium full-hand devnet test ===`);
  log(`RPC: ${RPC.replace(/api-key=[^&]+/, "api-key=REDACTED")}`);
  log(`Program: ${PROGRAM_ID.toBase58()}`);
  // Devnet RPC occasionally drops a request mid-run ("fetch failed"); retry so a
  // single transient blip doesn't kill a ~3-minute multi-step flow.
  const fetchWithRetry = async (url, opts) => {
    let lastErr;
    for (let i = 0; i < 6; i++) {
      try { return await fetch(url, opts); }
      catch (e) { lastErr = e; await sleep(400 * (i + 1)); }
    }
    throw lastErr;
  };
  const connection = new Connection(RPC, { commitment: "confirmed", fetch: fetchWithRetry });
  const authority = loadKp(WALLET_PATH);
  const { provider, program } = programFor(connection, authority);
  log(`Authority: ${authority.publicKey.toBase58()}  (${(await connection.getBalance(authority.publicKey)) / LAMPORTS_PER_SOL} SOL)`);

  // ---- MXE public key ----
  let mxePub = null;
  for (let i = 0; i < 30 && !mxePub; i++) { mxePub = await getMXEPublicKey(provider, PROGRAM_ID).catch(() => null); if (!mxePub) await sleep(1000); }
  if (!mxePub) throw new Error("MXE public key unavailable (nodes warming up?)");
  log(`MXE pubkey: ${Buffer.from(mxePub).toString("hex").slice(0, 16)}…`);

  // ---- 1. init 6 comp-defs (idempotent) ----
  log(`\n--- init comp-defs ---`);
  const arciumProgram = getArciumProgram(provider);
  const mxeAcc = await arciumProgram.account.mxeAccount.fetch(getMXEAccAddress(PROGRAM_ID));
  const lutAddr = getLookupTableAddress(PROGRAM_ID, mxeAcc.lutOffsetSlot);
  for (const c of CIRCUITS) {
    const cdAcc = getCompDefAccAddress(PROGRAM_ID, compDefOffset(c));
    const info = await connection.getAccountInfo(cdAcc);
    if (info) { log(`  ${c}: already initialized`); continue; }
    try {
      // OffChain circuit source: init is the whole step. No raw-circuit upload
      // and NO FinalizeComputationDefinition (that is the on-chain-upload path).
      // The MXE fetches + hash-verifies the .arcis from GitHub lazily.
      await program.methods[INIT_METHOD[c]]().accountsPartial({
        payer: authority.publicKey,
        mxeAccount: getMXEAccAddress(PROGRAM_ID),
        compDefAccount: cdAcc,
        addressLookupTable: lutAddr,
        lutProgram: LUT_PROGRAM_ID,
        arciumProgram: getArciumProgramId(),
        systemProgram: SystemProgram.programId,
      }).rpc({ commitment: "confirmed" });
      log(`  ${c}: initialized (offchain source)`);
    } catch (e) {
      log(`  ${c}: init failed — ${e.message?.slice(0, 160)}`);
      throw e;
    }
    await sleep(1500);
  }

  // ---- 2. token + players setup ----
  log(`\n--- setup: mint + 2 players ---`);
  const mint = await splToken.createMint(connection, authority, authority.publicKey, null, 6);
  log(`  test mint: ${mint.toBase58()}`);
  const players = [Keypair.generate(), Keypair.generate()];
  for (const p of players) {
    const t = new (require("@solana/web3.js").Transaction)().add(
      SystemProgram.transfer({ fromPubkey: authority.publicKey, toPubkey: p.publicKey, lamports: 0.4 * LAMPORTS_PER_SOL })
    );
    await provider.sendAndConfirm(t, [authority]);
    const ata = await splToken.getOrCreateAssociatedTokenAccount(connection, authority, mint, p.publicKey);
    await splToken.mintTo(connection, authority, mint, ata.address, authority, 1_000_000_000); // 1000 tokens
  }
  log(`  funded + minted to ${players.map((p) => p.publicKey.toBase58().slice(0, 4)).join(", ")}`);

  // ---- 3. create table ----
  log(`\n--- create table ---`);
  const tableId = Array.from(randomBytes(32));
  const tPda = tablePda(tableId);
  const smallBlind = new BN(1_000_000), bigBlind = new BN(2_000_000);
  await program.methods.createTable(tableId, smallBlind, bigBlind, new BN(50_000_000), new BN(500_000_000), 6, 0, new BN(0))
    .accounts({ authority: authority.publicKey, table: tPda, mint, vault: vaultPda(tPda), tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
    .rpc({ commitment: "confirmed" });
  log(`  table ${tPda.toBase58().slice(0, 8)}… created`);

  // ---- 4. join ----
  const x25 = players.map(() => { const sk = x25519.utils.randomSecretKey(); return { sk, pk: x25519.getPublicKey(sk) }; });
  for (let i = 0; i < 2; i++) {
    const p = players[i];
    const { program: pProg } = programFor(connection, p);
    const ata = splToken.getAssociatedTokenAddressSync(mint, p.publicKey);
    await pProg.methods.joinTable(i, new BN(200_000_000))
      .accounts({ player: p.publicKey, table: tPda, playerSeat: seatPda(tPda, i), playerTokenAccount: ata, vault: vaultPda(tPda), mint, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
      .rpc({ commitment: "confirmed" });
    log(`  seat ${i} joined by ${p.publicKey.toBase58().slice(0, 4)}`);
  }

  // ---- 5. start hand ----
  const table = await program.account.table.fetch(tPda);
  const handNo = table.handNumber.toNumber() + 1;
  const hPda = handPda(tPda, handNo), dPda = deckPda(tPda, handNo);
  await program.methods.startHand().accounts({ caller: authority.publicKey, table: tPda, handState: hPda, deckState: dPda, systemProgram: SystemProgram.programId }).rpc({ commitment: "confirmed" });
  log(`\n--- hand #${handNo} started ---`);

  // ---- 6. shuffle (MPC) ----
  log(`shuffle (MPC)…`);
  let off = newOffset();
  await program.methods.shuffle(off).accountsPartial({ payer: authority.publicKey, ...arciumQueueAccounts(off, "shuffle"), table: tPda, handState: hPda, deckState: dPda }).rpc({ skipPreflight: true, commitment: "confirmed" });
  await awaitComputationFinalization(provider, off, PROGRAM_ID, "confirmed");
  log(`  deck sealed on-chain ✓`);

  // ---- 7. deal_to_seat each player (MPC) + decrypt ----
  const hole = [];
  for (let i = 0; i < 2; i++) {
    const p = players[i];
    const { program: pProg, provider: pProv } = programFor(connection, p);
    const nonce = randomBytes(16);
    off = newOffset();
    await pProg.methods.dealToSeat(off, i, Array.from(x25[i].pk), new BN(deserializeLE(nonce).toString()))
      .accountsPartial({ payer: p.publicKey, ...arciumQueueAccounts(off, "deal_to_seat"), table: tPda, handState: hPda, deckState: dPda, playerSeat: seatPda(tPda, i) })
      .rpc({ skipPreflight: true, commitment: "confirmed" });
    await awaitComputationFinalization(pProv, off, PROGRAM_ID, "confirmed");
    await sleep(2500); // let the callback tx land + confirm
    const myPubHex = Buffer.from(x25[i].pk).toString("hex");
    const d = await findHoleDealt(connection, program, myPubHex);
    if (!d) throw new Error(`seat ${i}: no HoleDealt event found in recent txs`);
    const cipher = new RescueCipher(x25519.getSharedSecret(x25[i].sk, mxePub));
    const [c0, c1] = cipher.decrypt([Array.from(d.card0), Array.from(d.card1)], new Uint8Array(d.nonce));
    hole[i] = [Number(c0), Number(c1)];
    const ok = hole[i].every((c) => c >= 0 && c <= 51);
    log(`  seat ${i} dealt: [${hole[i]}] ${ok ? "✓" : "✗ INVALID"}`);
  }
  // sanity: 4 distinct cards
  const allCards = [...hole[0], ...hole[1]];
  log(`  distinct hole cards: ${new Set(allCards).size}/4 ${new Set(allCards).size === 4 ? "✓" : "✗"}`);

  // ---- 8. betting driver: everyone checks/calls until awaiting_community_reveal or showdown ----
  async function driveBetting() {
    for (let guard = 0; guard < 20; guard++) {
      const hs = await program.account.handState.fetch(hPda);
      const phase = Object.keys(hs.phase)[0];
      if (hs.awaitingCommunityReveal || phase === "showdown" || phase === "settled") return { hs, phase };
      const seat = hs.actionOn;
      const p = players[seat];
      if (!p) { log(`  action_on=${seat} has no local player; stopping`); return { hs, phase }; }
      const { program: pProg } = programFor(connection, p);
      const toCall = hs.currentBet.sub(await seatBet(seat));
      const action = toCall.gtn(0) ? { call: {} } : { check: {} };
      await pProg.methods.playerAction(action)
        .accountsPartial({ signer: p.publicKey, table: tPda, handState: hPda, deckState: dPda, playerSeat: seatPda(tPda, seat), sessionToken: null })
        .rpc({ commitment: "confirmed" });
      log(`  seat ${seat} ${Object.keys(action)[0]} (phase ${phase})`);
      await sleep(400);
    }
    throw new Error("betting driver exceeded guard");
  }
  async function seatBet(i) { const s = await program.account.playerSeat.fetch(seatPda(tPda, i)); return s.currentBet; }

  async function revealStreet(circuit, method) {
    off = newOffset();
    await program.methods[method](off).accountsPartial({ payer: authority.publicKey, caller: authority.publicKey, ...arciumQueueAccounts(off, circuit), table: tPda, handState: hPda, deckState: dPda, sessionToken: null }).rpc({ skipPreflight: true, commitment: "confirmed" });
    await awaitComputationFinalization(provider, off, PROGRAM_ID, "confirmed");
    const hs = await program.account.handState.fetch(hPda);
    log(`  ${circuit} → board [${hs.communityCards.filter((c) => c !== 255)}] (revealed ${hs.communityRevealed})`);
  }

  log(`\n--- betting + community reveals ---`);
  let st = await driveBetting();
  // Flop
  if (st.hs.awaitingCommunityReveal) { await revealStreet("reveal_flop", "revealFlop"); st = await driveBetting(); }
  if (st.hs.awaitingCommunityReveal) { await revealStreet("reveal_turn", "revealTurn"); st = await driveBetting(); }
  if (st.hs.awaitingCommunityReveal) { await revealStreet("reveal_river", "revealRiver"); st = await driveBetting(); }

  const hsFinal = await program.account.handState.fetch(hPda);
  log(`  phase now: ${Object.keys(hsFinal.phase)[0]}`);

  // ---- 9. showdown_reveal (MPC) ----
  if (Object.keys(hsFinal.phase)[0] === "showdown") {
    log(`\n--- showdown_reveal (MPC) ---`);
    off = newOffset();
    const seatMetas = [0, 1].map((i) => ({ pubkey: seatPda(tPda, i), isSigner: false, isWritable: true }));
    await program.methods.showdownReveal(off).accountsPartial({ payer: authority.publicKey, ...arciumQueueAccounts(off, "showdown_reveal"), table: tPda, handState: hPda, deckState: dPda }).remainingAccounts(seatMetas).rpc({ skipPreflight: true, commitment: "confirmed" });
    await awaitComputationFinalization(provider, off, PROGRAM_ID, "confirmed");
    for (let i = 0; i < 2; i++) {
      const s = await program.account.playerSeat.fetch(seatPda(tPda, i));
      log(`  seat ${i} revealed: [${s.revealedCard1}, ${s.revealedCard2}] (cardsRevealed=${s.cardsRevealed})  | dealt was [${hole[i]}]  match=${s.revealedCard1 === hole[i][0] && s.revealedCard2 === hole[i][1]}`);
    }
    // ---- 10. showdown (payout) ----
    await program.methods.showdown().accounts({ caller: authority.publicKey, table: tPda, handState: hPda }).remainingAccounts(seatMetas).rpc({ commitment: "confirmed" });
    const done = await program.account.handState.fetch(hPda);
    log(`\n  showdown complete — phase ${Object.keys(done.phase)[0]}, pot ${done.pot.toString()}`);
    for (let i = 0; i < 2; i++) { const s = await program.account.playerSeat.fetch(seatPda(tPda, i)); log(`  seat ${i} chips: ${s.chips.toString()}`); }
  } else {
    log(`\n  hand ended pre-showdown (phase ${Object.keys(hsFinal.phase)[0]}) — likely a fold path`);
  }

  log(`\n=== DONE ✓ full hand ran through the Arcium MPC pipeline ===`);
}

main().then(() => process.exit(0)).catch((e) => { console.error("\nFAILED:", e); if (e.logs) console.error(e.logs.join("\n")); process.exit(1); });
