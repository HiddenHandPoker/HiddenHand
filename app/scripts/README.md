# HiddenHand app scripts

CommonJS on purpose: `require('@arcium-hq/client')` resolves the `.cjs` build
(same reason as `devnet-full-hand.cjs`). Run from `app/`.

## Demo crank (`demo-crank.cjs`)

Permissionless keeper for the pinned World's Fair table. Polls every 2s and
fires at most one instruction per tick: `start_hand`, `shuffle`, community
reveals, `showdown_reveal`, `showdown`, plus `timeout_deal` /
`timeout_showdown` (and `timeout_player`) on stalls.

`deal_to_seat` is C-1 gated — the crank key never deals a seat it does not
own. Player A/B keypairs sit at boot and, when they occupy a seat, deal and
check/call as those wallets so an unattended table can actually complete a
hand. Spectators still see card backs until `showdown_reveal`.

Table id string must stay in lockstep with `app/lib/demo.ts`
(`DEMO_TABLE_ID = "judge-demo"`). On-chain it is that UTF-8 string
zero-padded to 32 bytes.

HHC mint: `59JzBXJybnMs1HaWGXqVL9LS7eiHYcicbuUL78GGYVjC`. Player A/B need
devnet SOL (fees) and HHC (min buy-in). The crank needs SOL. Do not sit the
upgrade-authority key as a player.

Public `https://api.devnet.solana.com` drops Arcium txs — the script refuses
it. Cluster offset **456**.

```
RPC_URL           Helius (required)
CRANK_KEYPAIR     path to json (authority)
PLAYER_A_KEYPAIR  path to json
PLAYER_B_KEYPAIR  path to json
DEMO_TABLE_ID     judge-demo
```

```bash
cd app
RPC_URL=$RPC_URL \
  CRANK_KEYPAIR=$CRANK_KEYPAIR \
  PLAYER_A_KEYPAIR=$PLAYER_A_KEYPAIR \
  PLAYER_B_KEYPAIR=$PLAYER_B_KEYPAIR \
  node scripts/demo-crank.cjs
```

Ctrl-C stops the loop. Do not print or commit key material.

## Other scripts

- `devnet-full-hand.cjs` — one-shot Arcium MPC hand against a throwaway table.
- `devnet-exploit-checks.cjs` / `devnet-timeout-showdown.cjs` /
  `test-timeout-deal.cjs` — audit / timeout regressions. Same `RPC_URL` rule.
