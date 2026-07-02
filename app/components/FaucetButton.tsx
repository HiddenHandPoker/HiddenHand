"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

/**
 * "Get chips" button — mints free HiddenHand Chips (HHC) to the connected wallet
 * via the /api/faucet route, so a new player has a one-tap buy-in on devnet
 * instead of hunting for a USDC faucet. No-op UI when no wallet is connected.
 */
export function FaucetButton({
  className = "",
  onSuccess,
}: {
  className?: string;
  onSuccess?: () => void;
}) {
  const { publicKey } = useWallet();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  if (!publicKey) return null;

  const getChips = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toBase58() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Faucet failed");
      setOk(true);
      setMsg(`+${data.amount} ${data.symbol}`);
      onSuccess?.();
      setTimeout(() => setMsg(null), 4000);
    } catch (e) {
      setOk(false);
      setMsg(e instanceof Error ? e.message : "Faucet error");
      setTimeout(() => setMsg(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={getChips}
        disabled={loading}
        title="Mint free devnet chips to your wallet"
        className={`px-4 sm:px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white transition-colors touch-target disabled:opacity-60 ${className}`}
      >
        {loading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        {loading ? "Minting…" : "Get chips"}
      </button>
      {msg && (
        <span
          className={`absolute left-1/2 -translate-x-1/2 top-full mt-1 whitespace-nowrap text-xs font-medium px-2 py-1 rounded-lg ${
            ok ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
          }`}
        >
          {msg}
        </span>
      )}
    </div>
  );
}
