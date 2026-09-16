# HiddenHand app

Next.js 16 client for the Arcium-MPC poker program
`GAc5rZPEFfaevbTL6F5jqWAuYQUNVHPfaQ2dRc5tFgSz` (Solana devnet).

## Run

cp .env.example .env.local   # if present; otherwise export:
# NEXT_PUBLIC_SOLANA_RPC=https://<helius-or-equivalent>/devnet
# FAUCET_SECRET=<base58 mint authority>   # server only, never NEXT_PUBLIC_

npm install
npm run dev
