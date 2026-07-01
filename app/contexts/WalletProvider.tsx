"use client";

import { FC, ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";

// Import wallet adapter styles
import "@solana/wallet-adapter-react-ui/styles.css";

// Network configuration - change this to switch between localnet and devnet
// For development: "localnet" (requires solana-test-validator running)
// For demo/production: "devnet"
export type Network = "localnet" | "devnet";
export const NETWORK: Network = "devnet";

// Solana RPC endpoints.
//
// IMPORTANT for the Arcium build: the public devnet RPC (clusterApiUrl) DROPS
// Arcium MPC transactions, so the deployed site MUST point at a reliable RPC
// (Helius/QuickNode/Triton). Set it via the NEXT_PUBLIC_SOLANA_RPC env var
// (e.g. in the Netlify dashboard) so the key isn't committed to the repo.
// Falls back to public devnet for local dev without a key configured.
const ENDPOINTS: Record<Network, string> = {
  localnet: "http://127.0.0.1:8899",
  devnet: process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl("devnet"),
};

interface Props {
  children: ReactNode;
}

export const WalletProvider: FC<Props> = ({ children }) => {
  const endpoint = useMemo(() => ENDPOINTS[NETWORK], []);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};
