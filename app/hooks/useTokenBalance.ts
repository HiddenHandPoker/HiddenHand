"use client";

import { useState, useCallback, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

/**
 * Hook to fetch a wallet's SPL token balance for a given mint.
 * Returns balance in base units (e.g. 1_500_000 for 1.5 USDC).
 */
export function useTokenBalance(mint: PublicKey | null) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!publicKey || !mint) {
      setBalance(null);
      return;
    }

    setLoading(true);
    try {
      const ata = getAssociatedTokenAddressSync(mint, publicKey);
      const info = await connection.getTokenAccountBalance(ata);
      setBalance(Number(info.value.amount));
    } catch {
      // Account doesn't exist = 0 balance
      setBalance(0);
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey, mint]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { balance, loading, refresh };
}
