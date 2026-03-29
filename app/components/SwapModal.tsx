"use client";

import { useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { getDefaultToken } from "@/lib/tokens";

interface SwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after a successful swap — use to refresh balances */
  onSuccess?: () => void;
  /** Override the output mint (defaults to USDC for the current network) */
  outputMint?: string;
}

/**
 * Modal wrapper around Jupiter Plugin for swapping any token to USDC.
 * Uses the window.Jupiter global loaded via script tag in layout.tsx.
 */
export function SwapModal({ isOpen, onClose, onSuccess, outputMint }: SwapModalProps) {
  const wallet = useWallet();
  const { setVisible: showWalletModal } = useWalletModal();
  const initedRef = useRef(false);
  // Use refs for callbacks to avoid re-init cycles
  const onCloseRef = useRef(onClose);
  const onSuccessRef = useRef(onSuccess);
  onCloseRef.current = onClose;
  onSuccessRef.current = onSuccess;

  const mint = outputMint ?? getDefaultToken().mint.toBase58();

  // Sync wallet state whenever it changes
  useEffect(() => {
    if (initedRef.current && window.Jupiter) {
      window.Jupiter.syncProps({ passthroughWalletContextState: wallet });
    }
  }, [wallet]);

  // Open/close the Jupiter modal
  useEffect(() => {
    if (!isOpen) return;

    const tryOpen = () => {
      if (typeof window === "undefined" || !window.Jupiter) {
        // Script still loading — retry
        setTimeout(tryOpen, 200);
        return;
      }

      window.Jupiter.init({
        displayMode: "modal",
        formProps: {
          initialOutputMint: mint,
          fixedMint: mint,
        },
        enableWalletPassthrough: true,
        passthroughWalletContextState: wallet,
        onRequestConnectWallet: () => showWalletModal(true),
        onSuccess: ({ txid }) => {
          console.log("Swap successful:", txid);
          onSuccessRef.current?.();
          setTimeout(() => onCloseRef.current(), 1500);
        },
      });
      initedRef.current = true;
      window.Jupiter.resume();
    };

    tryOpen();

    return () => {
      if (window.Jupiter && initedRef.current) {
        window.Jupiter.close();
      }
    };
  }, [isOpen, mint]); // eslint-disable-line react-hooks/exhaustive-deps

  // Jupiter renders its own modal overlay — nothing to render here
  return null;
}
