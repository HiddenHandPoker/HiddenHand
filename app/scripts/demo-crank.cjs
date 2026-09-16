/* eslint-disable */
/**
 * HiddenHand — permissionless crank for the pinned World's Fair table.
 *
 * Keeps `judge-demo` in Playing or Waiting with ≥2 seated wallets. Polls every
 * 2s and fires at most one instruction per tick.
 *
 * Protocol (crank key): start_hand, shuffle, reveal_flop/turn/river,
 * showdown_reveal, showdown, timeout_deal / timeout_showdown / timeout_player.
 * Never `deal_to_seat` unless the crank key *is* that seat's `player` (C-1).
 *
 * Player A/B (their own keypairs): join at boot; auto-deal and check/call so
 * an unattended exhibit can complete a hand. Hole cards are sealed to a
 * per-process x25519 key — spectators see backs until showdown_reveal.
 *
 * DEMO_TABLE_ID is hardcoded to "judge-demo" (override with env). Must stay in
 * lockstep with `app/lib/demo.ts`. On-chain table_id = UTF-8 padded to 32 bytes.
 *
 * CommonJS: `require('@arcium-hq/client')` resolves the .cjs build (same as
 * `devnet-full-hand.cjs`). Cluster offset 456. Program from the IDL.
 *
 * Run from app/:  RPC_URL=<helius> node scripts/demo-crank.cjs
 */
const fs = require("fs");
const path = require("path");
const anchor = require("@anchor-lang/core");
const { Program, AnchorProvider, BN, Wallet } = anchor;
const {
  Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL,
} = require("@solana/web3.js");
const splToken = require("@solana/spl-token");
const {
  x25519, deserializeLE, awaitComputationFinalization,
  getArciumProgramId, getArciumSignerAccAddress, getMXEAccAddress,
  getMempoolAccAddress, getExecutingPoolAccAddress, getComputationAccAddress,
  getCompDefAccAddress, getCompDefAccOffset, getClusterAccAddress,
  getFeePoolAccAddress, getClockAccAddress,
} = require("@arcium-hq/client");
const { randomBytes } = require("crypto");

// ---------- config ----------
const CLUSTER_OFFSET = 456;
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const HHC_MINT = new PublicKey("59JzBXJybnMs1HaWGXqVL9LS7eiHYcicbuUL78GGYVjC");
const IDL = require(path.join(__dirname, "..", "lib", "idl", "hiddenhand.json"));
const PROGRAM_ID = new PublicKey(IDL.address);

// Must stay in lockstep with `export const DEMO_TABLE_ID` in app/lib/demo.ts.
const DEMO_TABLE_ID = process.env.DEMO_TABLE_ID || "judge-demo";

const UPGRADE_AUTHORITY = new PublicKey("CbRBAijxZrSre8TZWX1VWeEJSsD4Z2foEpsn1rbAJCdZ");
const PUBLIC_DEVNET = "https://api.devnet.solana.com";

const POLL_MS = 2000;
const DEAL_TIMEOUT_SECONDS = 30;
const ACTION_TIMEOUT_SECONDS = 60;
const REVEAL_TIMEOUT_SECONDS = 180;
const MPC_WATCH_MS = 180_000;

// Modest 1/2 HHC, 6-max. min buy-in ≥ 10 BB. Rake matches getRakeForBlinds(2 HHC) Medium.
const SMALL_BLIND = 1_000_000;
const BIG_BLIND = 2_000_000;
const MIN_BUY_IN = 50_000_000;
const MAX_BUY_IN = 500_000_000;
const MAX_PLAYERS = 6;
const RAKE_BPS = 400;
const RAKE_CAP = 5_000_000;

const MPC_KINDS = new Set([
  "shuffle", "deal_to_seat", "reveal_flop", "reveal_turn", "reveal_river", "showdown_reveal",
]);

// ---------- helpers ----------
const log = (...a) => console.log(new Date().toISOString(), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const loadKp = (p) => Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(p, "utf8"))));
const compDefOffset = (name) => Buffer.from(getCompDefAccOffset(name)).readUInt32LE(0);
const u64le = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
const variant = (e) => (e && typeof e === "object" ? Object.keys(e)[0] : String(e));
const bnNum = (x) => (x == null ? 0 : typeof x === "number" ? x : Number(x.toString()));
const newOffset = () => new BN(randomBytes(8), "le");

function tableIdBytes(id) {
  const out = Buffer.alloc(32);
  Buffer.from(String(id), "utf8").copy(out, 0, 0, 32);
  return Array.from(out);
}

const tablePda = (idBytes) => PublicKey.findProgramAddressSync([Buffer.from("table"), Buffer.from(idBytes)], PROGRAM_ID)[0];
const seatPda = (t, i) => PublicKey.findProgramAddressSync([Buffer.from("seat"), t.toBuffer(), Buffer.from([i])], PROGRAM_ID)[0];
const handPda = (t, n) => PublicKey.findProgramAddressSync([Buffer.from("hand"), t.toBuffer(), u64le(n)], PROGRAM_ID)[0];
const deckPda = (t, n) => PublicKey.findProgramAddressSync([Buffer.from("deck"), t.toBuffer(), u64le(n)], PROGRAM_ID)[0];
const vaultPda = (t) => PublicKey.findProgramAddressSync([Buffer.from("vault"), t.toBuffer()], PROGRAM_ID)[0];

function occupiedIndices(bitmap, maxPlayers) {
  const out = [];
  for (let i = 0; i < maxPlayers; i++) if (bitmap & (1 << i)) out.push(i);
  return out;
}

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

function programFor(connection, kp) {
  const provider = new AnchorProvider(connection, new Wallet(kp), {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  return { provider, program: new Program(IDL, provider) };
}

function redactRpc(url) {
  return String(url).replace(/api-key=[^&]+/gi, "api-key=REDACTED");
}

function errText(e) {
  const msg = e?.message || String(e);
  const logs = Array.isArray(e?.logs) ? e.logs.join("\n") : "";
  return logs ? `${msg}\n${logs}` : msg;
}

function requireRpc() {
  const rpc = process.env.RPC_URL;
  if (!rpc) {
    throw new Error("RPC_URL is required (Helius or equivalent). Public devnet drops Arcium txs.");
  }
  const trimmed = rpc.trim();
  if (trimmed === PUBLIC_DEVNET || trimmed.startsWith(PUBLIC_DEVNET + "/")) {
    throw new Error("Refusing https://api.devnet.solana.com — it drops Arcium txs. Set RPC_URL to Helius (or equivalent).");
  }
  return trimmed;
}

function requireKp(envName) {
  const p = process.env[envName];
  if (!p) throw new Error(`${envName} is required (path to a json keypair)`);
  if (!fs.existsSync(p)) throw new Error(`${envName} file not found: ${p}`);
  return loadKp(p);
}

async function clusterNow(connection) {
  try {
    const slot = await connection.getSlot("confirmed");
    const t = await connection.getBlockTime(slot);
    if (t) return t;
  } catch (_) { /* fall through */ }
  return Math.floor(Date.now() / 1000);
}

function seatMetas(tPda, indices, writable) {
  return indices.map((i) => ({ pubkey: seatPda(tPda, i), isSigner: false, isWritable: writable }));
}

async function sendIx(label, builder, opts) {
  const sig = await builder.rpc(opts || { commitment: "confirmed" });
  log(`ix ${label}  ${sig}`);
  return sig;
}

// ---------- main ----------
async function main() {
  const RPC = requireRpc();
  const crank = requireKp("CRANK_KEYPAIR");
  const playerA = requireKp("PLAYER_A_KEYPAIR");
  const playerB = requireKp("PLAYER_B_KEYPAIR");

  if (playerA.publicKey.equals(playerB.publicKey)) {
    throw new Error("PLAYER_A_KEYPAIR and PLAYER_B_KEYPAIR must be different wallets (one wallet per table)");
  }
  for (const [name, kp] of [["PLAYER_A", playerA], ["PLAYER_B", playerB]]) {
    if (kp.publicKey.equals(UPGRADE_AUTHORITY)) {
      throw new Error(`${name}_KEYPAIR is the upgrade-authority — do not sit that key as a player`);
    }
  }

  const fetchWithRetry = async (url, opts) => {
    let lastErr;
    for (let i = 0; i < 8; i++) {
      try {
        const res = await fetch(url, opts);
        if (res.status === 429) {
          await sleep(500 * (i + 1) * (i + 1));
          continue;
        }
        return res;
      } catch (e) {
        lastErr = e;
        await sleep(400 * (i + 1));
      }
    }
    if (lastErr) throw lastErr;
    throw new Error("RPC retries exhausted (429)");
  };

  const connection = new Connection(RPC, { commitment: "confirmed", fetch: fetchWithRetry });
  const { provider, program } = programFor(connection, crank);
  const idBytes = tableIdBytes(DEMO_TABLE_ID);
  const tPda = tablePda(idBytes);
  const vPda = vaultPda(tPda);

  log("=== HiddenHand demo crank ===");
  log(`RPC        ${redactRpc(RPC)}`);
  log(`Program    ${PROGRAM_ID.toBase58()}`);
  log(`Table id   "${DEMO_TABLE_ID}"  (lockstep with app/lib/demo.ts)`);
  log(`Table PDA  ${tPda.toBase58()}`);
  log(`Crank      ${crank.publicKey.toBase58()}`);
  log(`Player A   ${playerA.publicKey.toBase58()}`);
  log(`Player B   ${playerB.publicKey.toBase58()}`);

  const bots = [
    { name: "A", kp: playerA, encPk: x25519.getPublicKey(x25519.utils.randomSecretKey()) },
    { name: "B", kp: playerB, encPk: x25519.getPublicKey(x25519.utils.randomSecretKey()) },
  ];
  const botByPk = (pk) => bots.find((b) => b.kp.publicKey.equals(pk));

  let inFlight = null; // { kind, offset, startedAt, failed }
  let lastSnap = "";
  let completedHands = 0;
  let abortedHands = 0;
  let running = true;
  process.on("SIGINT", () => { log("SIGINT — stopping after this tick"); running = false; });
  process.on("SIGTERM", () => { log("SIGTERM — stopping after this tick"); running = false; });

  function watchMpc(kind, offset) {
    awaitComputationFinalization(provider, offset, PROGRAM_ID, "confirmed", MPC_WATCH_MS)
      .then((sig) => log(`  ${kind} MPC finalized ${sig}`))
      .catch((e) => {
        log(`  ${kind} MPC watch: ${errText(e).slice(0, 240)}`);
        if (inFlight && inFlight.offset === offset) inFlight.failed = true;
      });
  }

  function markFlight(kind, offset) {
    inFlight = { kind, offset, startedAt: Date.now(), failed: false };
    if (MPC_KINDS.has(kind) && offset) watchMpc(kind, offset);
  }

  async function loadTable() {
    const info = await connection.getAccountInfo(tPda);
    if (!info) return null;
    return program.account.table.fetch(tPda);
  }

  async function loadSeats(table) {
    const seats = [];
    for (const i of occupiedIndices(table.occupiedSeats, table.maxPlayers)) {
      const pda = seatPda(tPda, i);
      try {
        const account = await program.account.playerSeat.fetch(pda);
        seats.push({ index: i, pda, account });
      } catch (e) {
        log(`  warn: occupied bit ${i} but seat fetch failed: ${(e.message || e).toString().slice(0, 120)}`);
      }
    }
    return seats;
  }

  async function loadHand(table) {
    const n = bnNum(table.handNumber);
    if (n < 1) return { hand: null, deck: null, hPda: null, dPda: null, handNo: 0 };
    const hPda = handPda(tPda, n);
    const dPda = deckPda(tPda, n);
    let hand = null;
    let deck = null;
    try { hand = await program.account.handState.fetch(hPda); } catch (_) { /* none */ }
    try { deck = await program.account.deckState.fetch(dPda); } catch (_) { /* none */ }
    return { hand, deck, hPda, dPda, handNo: n };
  }

  async function ensureTable(table) {
    if (table) {
      if (!table.tokenMint.equals(HHC_MINT)) {
        throw new Error(`table ${DEMO_TABLE_ID} mint is ${table.tokenMint.toBase58()}, expected HHC ${HHC_MINT.toBase58()}`);
      }
      if (variant(table.status) === "closed") {
        throw new Error(`table ${DEMO_TABLE_ID} is Closed — crank will not reopen it`);
      }
      log(`table exists  authority=${table.authority.toBase58()}  status=${variant(table.status)}  players=${table.currentPlayers}  hand=#${bnNum(table.handNumber)}`);
      if (!table.authority.equals(crank.publicKey)) {
        log("  crank is not table authority — start_hand / reveal / showdown wait 60s unless Task 3 has landed");
      }
      return table;
    }
    log("table PDA empty — create_table (HHC, 6-max, 1/2 blinds)");
    await sendIx(
      "create_table",
      program.methods
        .createTable(
          idBytes, new BN(SMALL_BLIND), new BN(BIG_BLIND),
          new BN(MIN_BUY_IN), new BN(MAX_BUY_IN), MAX_PLAYERS, RAKE_BPS, new BN(RAKE_CAP),
        )
        .accounts({
          authority: crank.publicKey,
          table: tPda,
          mint: HHC_MINT,
          vault: vPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        }),
    );
    return program.account.table.fetch(tPda);
  }

  async function joinOne(table, seats, bot) {
    if (seats.some((s) => s.account.player.equals(bot.kp.publicKey))) return false;
    if (table.currentPlayers >= table.maxPlayers) {
      log(`  ${bot.name}: table full, cannot sit`);
      return false;
    }
    let seatIndex = -1;
    for (let i = 0; i < table.maxPlayers; i++) {
      if (!(table.occupiedSeats & (1 << i))) { seatIndex = i; break; }
    }
    if (seatIndex < 0) return false;

    const { program: pProg } = programFor(connection, bot.kp);
    const ata = splToken.getAssociatedTokenAddressSync(HHC_MINT, bot.kp.publicKey);
    let bal = 0;
    try {
      bal = Number((await splToken.getAccount(connection, ata)).amount);
    } catch (_) {
      log(`  ${bot.name}: no HHC ATA — fund via faucet before sitting`);
      return false;
    }
    if (bal < MIN_BUY_IN) {
      log(`  ${bot.name}: HHC balance ${bal} < min buy-in ${MIN_BUY_IN}`);
      return false;
    }
    const sol = await connection.getBalance(bot.kp.publicKey);
    if (sol < 0.02 * LAMPORTS_PER_SOL) {
      log(`  ${bot.name}: low SOL (${sol / LAMPORTS_PER_SOL}) — join may fail on fees`);
    }

    const remaining = seatMetas(tPda, occupiedIndices(table.occupiedSeats, table.maxPlayers), false);
    await sendIx(
      `join_table ${bot.name} seat ${seatIndex}`,
      pProg.methods.joinTable(seatIndex, new BN(MIN_BUY_IN)).accounts({
        player: bot.kp.publicKey,
        table: tPda,
        playerSeat: seatPda(tPda, seatIndex),
        playerTokenAccount: ata,
        vault: vPda,
        mint: HHC_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }).remainingAccounts(remaining),
    );
    return true;
  }

  async function sitIfNeeded(table, seats) {
    if (variant(table.status) !== "waiting") return false;
    if (table.currentPlayers >= 2) return false;
    for (const bot of bots) {
      if (seats.some((s) => s.account.player.equals(bot.kp.publicKey))) continue;
      return joinOne(table, seats, bot);
    }
    return false;
  }

  async function leaveBustedBot(table, seats) {
    if (variant(table.status) !== "waiting") return false;
    const busted = seats.find((s) => bnNum(s.account.chips) === 0 && botByPk(s.account.player));
    if (!busted) return false;
    const bot = botByPk(busted.account.player);
    const { program: pProg } = programFor(connection, bot.kp);
    const ata = splToken.getAssociatedTokenAddressSync(table.tokenMint, bot.kp.publicKey);
    await sendIx(
      `leave_table ${bot.name} seat ${busted.index} (0 chips)`,
      pProg.methods.leaveTable().accounts({
        player: bot.kp.publicKey,
        table: tPda,
        playerSeat: busted.pda,
        playerTokenAccount: ata,
        vault: vPda,
        mint: table.tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }),
    );
    return true;
  }

  async function startHand(table, seats) {
    const withChips = seats.filter((s) => bnNum(s.account.chips) > 0);
    if (withChips.length < 2) {
      log(`  start_hand skipped — occupied_with_chips=${withChips.length}`);
      return false;
    }
    const next = bnNum(table.handNumber) + 1;
    const remaining = seatMetas(tPda, occupiedIndices(table.occupiedSeats, table.maxPlayers), false);
    await sendIx(
      `start_hand #${next}`,
      program.methods.startHand().accounts({
        caller: crank.publicKey,
        table: tPda,
        handState: handPda(tPda, next),
        deckState: deckPda(tPda, next),
        systemProgram: SystemProgram.programId,
      }).remainingAccounts(remaining),
    );
    markFlight("start_hand", null);
    return true;
  }

  async function shuffle(hPda, dPda) {
    const off = newOffset();
    await sendIx(
      "shuffle",
      program.methods.shuffle(off).accountsPartial({
        payer: crank.publicKey,
        ...arciumQueueAccounts(off, "shuffle"),
        table: tPda,
        handState: hPda,
        deckState: dPda,
      }),
      { skipPreflight: true, commitment: "confirmed" },
    );
    markFlight("shuffle", off);
    return true;
  }

  async function revealStreet(phase, hPda, dPda) {
    const spec = {
      preFlop: { circuit: "reveal_flop", method: "revealFlop" },
      flop: { circuit: "reveal_turn", method: "revealTurn" },
      turn: { circuit: "reveal_river", method: "revealRiver" },
    }[phase];
    if (!spec) return false;
    const off = newOffset();
    await sendIx(
      spec.circuit,
      program.methods[spec.method](off).accountsPartial({
        payer: crank.publicKey,
        caller: crank.publicKey,
        ...arciumQueueAccounts(off, spec.circuit),
        table: tPda,
        handState: hPda,
        deckState: dPda,
        sessionToken: null,
      }),
      { skipPreflight: true, commitment: "confirmed" },
    );
    markFlight(spec.circuit, off);
    return true;
  }

  async function showdownReveal(table, hPda, dPda) {
    const off = newOffset();
    const remaining = seatMetas(tPda, occupiedIndices(table.occupiedSeats, table.maxPlayers), true);
    await sendIx(
      "showdown_reveal",
      program.methods.showdownReveal(off).accountsPartial({
        payer: crank.publicKey,
        ...arciumQueueAccounts(off, "showdown_reveal"),
        table: tPda,
        handState: hPda,
        deckState: dPda,
      }).remainingAccounts(remaining),
      { skipPreflight: true, commitment: "confirmed" },
    );
    markFlight("showdown_reveal", off);
    return true;
  }

  async function settleShowdown(table, hPda) {
    const remaining = seatMetas(tPda, occupiedIndices(table.occupiedSeats, table.maxPlayers), true);
    await sendIx(
      "showdown",
      program.methods.showdown().accounts({
        caller: crank.publicKey,
        table: tPda,
        handState: hPda,
      }).remainingAccounts(remaining),
    );
    completedHands += 1;
    log(`HAND_COMPLETED  total=${completedHands}  aborted=${abortedHands}`);
    inFlight = null;
    return true;
  }

  async function timeoutDeal(table, hPda, dPda) {
    const remaining = seatMetas(tPda, occupiedIndices(table.occupiedSeats, table.maxPlayers), true);
    await sendIx(
      "timeout_deal",
      program.methods.timeoutDeal().accounts({
        caller: crank.publicKey,
        table: tPda,
        handState: hPda,
        deckState: dPda,
      }).remainingAccounts(remaining),
    );
    abortedHands += 1;
    log(`HAND_ABORTED reason=deal_stall  total_aborted=${abortedHands}  completed=${completedHands}`);
    inFlight = null;
    return true;
  }

  async function timeoutShowdown(table, hPda) {
    const remaining = seatMetas(tPda, occupiedIndices(table.occupiedSeats, table.maxPlayers), true);
    await sendIx(
      "timeout_showdown",
      program.methods.timeoutShowdown().accounts({
        caller: crank.publicKey,
        table: tPda,
        handState: hPda,
      }).remainingAccounts(remaining),
    );
    abortedHands += 1;
    log(`HAND_ABORTED reason=reveal_stall  total_aborted=${abortedHands}  completed=${completedHands}`);
    inFlight = null;
    return true;
  }

  async function timeoutPlayer(hPda, dPda, seatIndex) {
    await sendIx(
      `timeout_player seat ${seatIndex}`,
      program.methods.timeoutPlayer().accounts({
        caller: crank.publicKey,
        table: tPda,
        handState: hPda,
        deckState: dPda,
        playerSeat: seatPda(tPda, seatIndex),
      }),
    );
    return true;
  }

  async function dealSeat(bot, seatIndex, hPda, dPda) {
    // C-1: payer must be player_seat.player. Only called with that bot's key.
    const { program: pProg } = programFor(connection, bot.kp);
    const nonce = randomBytes(16);
    const off = newOffset();
    bot.encPk = x25519.getPublicKey(x25519.utils.randomSecretKey());
    await sendIx(
      `deal_to_seat ${bot.name} seat ${seatIndex}`,
      pProg.methods
        .dealToSeat(off, seatIndex, Array.from(bot.encPk), new BN(deserializeLE(nonce).toString()))
        .accountsPartial({
          payer: bot.kp.publicKey,
          ...arciumQueueAccounts(off, "deal_to_seat_v2"),
          table: tPda,
          handState: hPda,
          deckState: dPda,
          playerSeat: seatPda(tPda, seatIndex),
        }),
      { skipPreflight: true, commitment: "confirmed" },
    );
    // deal_queued is set at queue time (idempotency). Do not block the other
    // seat's deal on this MPC — one ix per tick still serializes them.
    watchMpc("deal_to_seat", off);
    return true;
  }

  async function botAct(bot, seat, hand, hPda, dPda) {
    const { program: pProg } = programFor(connection, bot.kp);
    const toCall = bnNum(hand.currentBet) - bnNum(seat.account.currentBet);
    const action = toCall > 0 ? { call: {} } : { check: {} };
    await sendIx(
      `player_action ${bot.name} seat ${seat.index} ${Object.keys(action)[0]}`,
      pProg.methods.playerAction(action).accountsPartial({
        signer: bot.kp.publicKey,
        table: tPda,
        handState: hPda,
        deckState: dPda,
        playerSeat: seat.pda,
        sessionToken: null,
      }),
    );
    return true;
  }

  function flightResolved(kind, table, hand, deck, seats) {
    if (!inFlight || inFlight.kind !== kind) return false;
    switch (kind) {
      case "start_hand":
        return variant(table.status) === "playing";
      case "shuffle":
        return !!(deck && deck.isShuffled);
      case "reveal_flop":
        return !!(hand && hand.communityRevealed >= 3);
      case "reveal_turn":
        return !!(hand && hand.communityRevealed >= 4);
      case "reveal_river":
        return !!(hand && (hand.communityRevealed >= 5 || variant(hand.phase) === "showdown"));
      case "showdown_reveal": {
        if (!hand) return false;
        return seats
          .filter((s) => hand.activePlayers & (1 << s.index))
          .every((s) => s.account.cardsRevealed);
      }
      default:
        return false;
    }
  }

  // Boot: create table, sit A/B.
  let table = await ensureTable(await loadTable());
  {
    if (table.currentPlayers < 2) {
      log("sitting A/B at empty seats (min buy-in HHC)");
      for (let n = 0; n < 2 && table.currentPlayers < 2; n++) {
        const seats = await loadSeats(table);
        const did = await sitIfNeeded(table, seats);
        if (!did) break;
        table = await program.account.table.fetch(tPda);
      }
    } else {
      log(`≥2 already seated (${table.currentPlayers}) — not joining extra bots`);
    }
    const seated = await loadSeats(table);
    for (const s of seated) {
      const bot = botByPk(s.account.player);
      log(`  seat ${s.index}  ${s.account.player.toBase58()}  chips=${bnNum(s.account.chips)}  ${bot ? `bot ${bot.name}` : "other"}`);
    }
  }

  log("polling every 2s — Ctrl-C to stop");

  while (running) {
    try {
      table = await loadTable();
      if (!table) {
        log("table account disappeared — exiting");
        break;
      }
      const status = variant(table.status);
      if (status === "closed") {
        log("table Closed — exiting");
        break;
      }
      const seats = await loadSeats(table);
      const { hand, deck, hPda, dPda } = await loadHand(table);
      const phase = hand ? variant(hand.phase) : null;
      const now = await clusterNow(connection);
      const lastAction = hand ? bnNum(hand.lastActionTime) : 0;
      const elapsed = lastAction ? now - lastAction : 0;
      const withChips = seats.filter((s) => bnNum(s.account.chips) > 0).length;
      const isAuth = table.authority.equals(crank.publicKey);
      const lastReady = bnNum(table.lastReadyTime);
      const readyElapsed = lastReady ? now - lastReady : 0;

      const snap = [
        status, phase || "-",
        deck && deck.isShuffled ? "shuffled" : "unshuffled",
        hand ? `await=${!!hand.awaitingCommunityReveal}` : "",
        `p=${table.currentPlayers}`,
        `chips=${withChips}`,
        inFlight ? `flight=${inFlight.kind}` : "",
      ].join(" ");
      if (snap !== lastSnap) {
        log(`state  ${snap}  hand=#${bnNum(table.handNumber)}  pot=${hand ? bnNum(hand.pot) : 0}  elapsed=${elapsed}s`);
        lastSnap = snap;
      }

      if (inFlight && flightResolved(inFlight.kind, table, hand, deck, seats)) inFlight = null;
      if (inFlight && inFlight.failed) {
        log(`  in-flight ${inFlight.kind} aborted — will retry or timeout`);
        inFlight = null;
      }

      const skipNewMpc = !!(inFlight && MPC_KINDS.has(inFlight.kind));
      const skipStart = !!(inFlight && inFlight.kind === "start_hand");
      let acted = false;

      const go = async (fn) => {
        if (acted) return;
        try {
          acted = !!(await fn());
        } catch (e) {
          log(`  tx error: ${errText(e).slice(0, 400)}`);
          acted = true; // don't spam the same failing ix this tick
        }
      };

      // --- stall aborts (even while MPC is in flight, once the on-chain clock allows) ---
      if (!acted && status === "playing" && phase === "dealing" && elapsed >= DEAL_TIMEOUT_SECONDS) {
        await go(() => timeoutDeal(table, hPda, dPda));
      }
      if (!acted && status === "playing" && hand && elapsed >= REVEAL_TIMEOUT_SECONDS
          && (phase === "showdown" || hand.awaitingCommunityReveal)
          && hand.activeCount > 1) {
        const unrevealed = seats.some((s) =>
          (hand.activePlayers & (1 << s.index)) && !s.account.cardsRevealed);
        if (phase !== "showdown" || unrevealed) {
          await go(() => timeoutShowdown(table, hPda));
        }
      }

      // --- protocol state machine (one ix) ---
      if (!acted && status === "waiting" && withChips >= 2 && !skipStart) {
        if (isAuth || readyElapsed >= ACTION_TIMEOUT_SECONDS) {
          await go(() => startHand(table, seats));
        }
      }

      if (!acted && status === "playing" && phase === "dealing" && deck && !deck.isShuffled && !skipNewMpc) {
        await go(() => shuffle(hPda, dPda));
      }

      // C-1: crank does not deal unless it owns the seat. Bots deal themselves below.

      if (!acted && status === "playing" && hand && hand.awaitingCommunityReveal
          && (phase === "preFlop" || phase === "flop" || phase === "turn")
          && !skipNewMpc) {
        if (isAuth || elapsed >= ACTION_TIMEOUT_SECONDS) {
          await go(() => revealStreet(phase, hPda, dPda));
        }
      }

      if (!acted && status === "playing" && phase === "showdown" && hand && hand.activeCount > 1 && !skipNewMpc) {
        const needReveal = seats.some((s) =>
          (hand.activePlayers & (1 << s.index)) && !s.account.cardsRevealed);
        if (needReveal) await go(() => showdownReveal(table, hPda, dPda));
      }

      if (!acted && hand && hPda) {
        const allRevealed = phase === "showdown" && hand.activeCount > 1 && seats
          .filter((s) => hand.activePlayers & (1 << s.index))
          .every((s) => s.account.cardsRevealed);
        const loneWinner = phase === "settled" && hand.activeCount === 1 && bnNum(hand.pot) > 0 && status === "playing";
        if ((allRevealed || loneWinner) && (isAuth || elapsed >= ACTION_TIMEOUT_SECONDS)) {
          await go(() => settleShowdown(table, hPda));
        }
      }

      // --- player-signed deal / act (A/B keys only) ---
      if (!acted && status === "playing" && phase === "dealing" && deck && deck.isShuffled && hand && !skipNewMpc) {
        const undealt = seats.find((s) => {
          const active = hand.activePlayers & (1 << s.index);
          const queued = hand.dealQueued & (1 << s.index);
          const bot = botByPk(s.account.player);
          return active && !queued && bot;
        });
        if (undealt) {
          const bot = botByPk(undealt.account.player);
          await go(() => dealSeat(bot, undealt.index, hPda, dPda));
        }
      }

      if (!acted && status === "playing" && hand && !hand.awaitingCommunityReveal
          && (phase === "preFlop" || phase === "flop" || phase === "turn" || phase === "river")) {
        const actionSeat = seats.find((s) => s.index === hand.actionOn);
        const bot = actionSeat && botByPk(actionSeat.account.player);
        if (bot && actionSeat && variant(actionSeat.account.status) === "playing") {
          await go(() => botAct(bot, actionSeat, hand, hPda, dPda));
        } else if (actionSeat && elapsed >= ACTION_TIMEOUT_SECONDS) {
          await go(() => timeoutPlayer(hPda, dPda, actionSeat.index));
        }
      }

      // --- sit A/B if the table emptied between hands; rebuy busted bots ---
      if (!acted && status === "waiting" && table.currentPlayers < 2) {
        await go(() => sitIfNeeded(table, seats));
      }
      if (!acted && status === "waiting") {
        await go(() => leaveBustedBot(table, seats));
      }

      if (!acted && status === "waiting" && phase === "settled" && hand && bnNum(hand.pot) === 0) {
        // idle until start_hand on a later tick
      }
    } catch (e) {
      log(`tick error: ${errText(e).slice(0, 400)}`);
    }
    if (!running) break;
    await sleep(POLL_MS);
  }

  log(`stopped  HAND_COMPLETED=${completedHands}  HAND_ABORTED=${abortedHands}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("FATAL:", errText(e));
  process.exit(1);
});
