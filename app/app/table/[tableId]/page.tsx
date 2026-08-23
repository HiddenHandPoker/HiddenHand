"use client";

import React from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "@/components/WalletButton";
import { PokerTable } from "@/components/PokerTable";
import { ActionPanel } from "@/components/ActionPanel";
import { SpectatorView } from "@/components/SpectatorView";
import { useState, useEffect, useRef, useMemo } from "react";
import { usePokerGame, type ActionType } from "@/hooks/usePokerGame";
import { ActionTimer } from "@/components/ActionTimer";
import { OpponentTimer } from "@/components/OpponentTimer";
import { ShowdownTimeoutPanel } from "@/components/ShowdownTimeoutPanel";
import { AuthorityTimeoutPanel } from "@/components/AuthorityTimeoutPanel";
import { TransactionToast, useTransactionToasts } from "@/components/TransactionToast";
import { GameHistory, useGameHistory } from "@/components/GameHistory";
import { NETWORK } from "@/contexts/WalletProvider";
import { solToLamports, lamportsToSol } from "@/lib/utils";
import { getTokenByMint, getDefaultToken, baseUnitsToDisplay, displayToBaseUnits, type TokenInfo } from "@/lib/tokens";
import { evaluateHand, getHandDescription } from "@/lib/handEval";
import { useSounds, soundManager } from "@/lib/sounds";
import { SoundToggle } from "@/components/SoundToggle";
import { useHandHistory } from "@/hooks/useHandHistory";
import { OnChainHandHistory } from "@/components/OnChainHandHistory";
import { Tooltip, InfoIcon } from "@/components/Tooltip";
import { useChipAnimations } from "@/components/ChipAnimation";
import {
  ACTION_TIMEOUT_SECONDS,
  DEAL_TIMEOUT_SECONDS,
  ALLOWANCE_TIMEOUT_SECONDS,
  REVEAL_TIMEOUT_SECONDS,
  TABLE_INACTIVE_TIMEOUT_SECONDS,
} from "@/lib/constants";
import { usePlayerStats } from "@/hooks/usePlayerStats";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { SwapModal } from "@/components/SwapModal";
import { useResponsibleGaming } from "@/hooks/useResponsibleGaming";
import { useSessionKey } from "@/hooks/useSessionKey";
import { usePokerProgram } from "@/hooks/usePokerProgram";
import { SessionStatus } from "@/components/SessionStatus";
import { SessionTimer } from "@/components/SessionTimer";
import { BreakReminder } from "@/components/BreakReminder";
import { SelfExclusionBanner } from "@/components/SelfExclusionBanner";
import { RotateDeviceOverlay } from "@/components/RotateDeviceOverlay";
import { useIsMobileLandscape, useIsMobile } from "@/hooks/useIsMobile";
import { GameStatusBar } from "@/components/GameStatusBar";

export default function TablePage({ params }: { params: Promise<{ tableId: string }> }) {
  const { tableId } = React.use(params);
  const decodedTableId = decodeURIComponent(tableId);

  const { connected, publicKey, disconnect } = useWallet();
  const { provider } = usePokerProgram();

  // Session key for popup-free gameplay (auto-created on join)
  const {
    session: sessionState,
    createSession,
    activateSession,
    revokeSession,
    sendWithSession,
    loading: sessionLoading,
  } = useSessionKey(provider, publicKey);

  // Build session key param for usePokerGame
  // Always pass activateSession (needed by joinTable to set up the session).
  // Only pass signing fields when session is active.
  const sessionKeyParam = sessionState.isActive && sessionState.keypair && sessionState.sessionTokenPDA
    ? {
        signerPublicKey: sessionState.keypair.publicKey,
        sessionTokenPDA: sessionState.sessionTokenPDA,
        sendWithSession,
        activateSession,
        isActive: true as const,
      }
    : {
        signerPublicKey: publicKey!, // unused when !isActive
        sessionTokenPDA: publicKey!, // unused when !isActive
        sendWithSession,
        activateSession,
        isActive: false as const,
      };

  const {
    gameState,
    loading,
    error,
    joinTable,
    leaveTable,
    startHand,
    shuffleDeck,
    dealMeIn,
    retryDecrypt,
    revealHands,
    playerAction,
    showdown,
    timeoutPlayer,
    timeoutDeal,
    timeoutShowdown,
    setTableId,
    closeInactiveTable,
    program,
  } = usePokerGame(sessionKeyParam);

  // Set the table ID from URL parameter
  useEffect(() => {
    if (decodedTableId) {
      setTableId(decodedTableId);
    }
  }, [decodedTableId, setTableId]);

  // Responsible gaming
  const {
    formatSessionTime,
    showBreakReminder,
    dismissBreakReminder,
    isExcluded,
    exclusionTimeLeft,
    checkDepositAllowed,
    recordDeposit,
  } = useResponsibleGaming(publicKey?.toString() ?? null);

  // Mobile detection
  const isMobileLandscape = useIsMobileLandscape();
  const isMobile = useIsMobile();

  // On-chain hand history from events
  const { history: onChainHistory, handTimelines, isListening: isHistoryListening, loadingHistory } = useHandHistory(program, gameState.tablePDA);

  // Player stats for HUD tooltips
  const { fetchStats: fetchPlayerStats, allStats: playerStatsMap } = usePlayerStats();
  useEffect(() => {
    fetchPlayerStats();
  }, [fetchPlayerStats]);

  // Expose hook functions to window for console testing (development only)
  useEffect(() => {
    if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pokerGame = (window as any).__pokerGame || {};
      // Only update functions, not gameState (to avoid constant updates)
      pokerGame.shuffleDeck = shuffleDeck;
      pokerGame.dealMeIn = dealMeIn;
      pokerGame.revealHands = revealHands;
      pokerGame.timeoutShowdown = timeoutShowdown;
      pokerGame.timeoutDeal = timeoutDeal;
      pokerGame.closeInactiveTable = closeInactiveTable;
      pokerGame.getGameState = () => gameState;
      (window as any).__pokerGame = pokerGame;
    }
    return () => {
      if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (window as any).__pokerGame;
      }
    };
  }, [shuffleDeck, dealMeIn, revealHands, timeoutShowdown, timeoutDeal, closeInactiveTable]);

  // Transaction toast notifications
  const {
    transactions,
    addTransaction,
    updateTransaction,
    dismissTransaction,
  } = useTransactionToasts();

  // Game history/action log
  const { events: gameEvents, addEvent: addGameEvent, clearHistory } = useGameHistory();

  // Sound effects
  const { playSound, initSounds } = useSounds();

  // Initialize sounds on first user interaction
  useEffect(() => {
    const handleFirstInteraction = () => {
      initSounds();
      document.removeEventListener('click', handleFirstInteraction);
    };
    document.addEventListener('click', handleFirstInteraction);
    return () => document.removeEventListener('click', handleFirstInteraction);
  }, [initSounds]);

  // Wrapper to execute actions with toast notifications
  const withToast = async (
    action: () => Promise<string>,
    pendingMessage: string,
    successMessage: string
  ) => {
    // Add pending toast immediately so user sees something is happening
    const toastId = addTransaction("pending", pendingMessage);
    try {
      const tx = await action();
      // Update with actual transaction signature and mark as confirmed
      updateTransaction(toastId, "confirmed", tx);
      return tx;
    } catch (e) {
      // Update toast to show error
      const errorMessage = e instanceof Error ? e.message : "Transaction failed";
      updateTransaction(toastId, "error", undefined, errorMessage);
      throw e;
    }
  };

  // Resolve token info from table's configured mint
  const tableToken: TokenInfo = useMemo(() => {
    if (gameState.table?.tokenMint) {
      return getTokenByMint(gameState.table.tokenMint) ?? getDefaultToken();
    }
    return getDefaultToken();
  }, [gameState.table?.tokenMint]);
  const fmt = (baseUnits: number) => baseUnitsToDisplay(baseUnits, tableToken).toFixed(2);

  // UI state
  const [buyInSol, setBuyInSol] = useState(10); // Default buy-in in display units (e.g. $10 USDC)
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [depositLimitMsg, setDepositLimitMsg] = useState<string | null>(null);

  // USDC balance check for join flow
  const { balance: usdcBalance, refresh: refreshBalance } = useTokenBalance(tableToken.mint);

  // Win celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationWinAmount, setCelebrationWinAmount] = useState<number | undefined>(undefined);

  // Auto-dismiss win celebration after 2 seconds
  useEffect(() => {
    if (showCelebration) {
      const timeout = setTimeout(() => {
        setShowCelebration(false);
        setCelebrationWinAmount(undefined);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [showCelebration]);

  // Chip animation state
  const { betTrigger, winTrigger, triggerBetAnimation, triggerWinAnimation } = useChipAnimations();
  const prevBetsRef = useRef<Map<number, number>>(new Map());

  // Prefill from Quick Play / click-to-sit query params.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const buy = params.get("buyIn");
    const seat = params.get("seat");
    if (buy) {
      const n = Number(buy);
      if (Number.isFinite(n) && n > 0) setBuyInSol(n);
    }
    if (seat !== null && seat !== "") {
      const n = Number(seat);
      if (Number.isInteger(n) && n >= 0) setSelectedSeat(n);
    }
  }, []);

  const autoJoinLock = useRef(false);

  // Auto-set buy-in to table minimum when table loads
  useEffect(() => {
    if (gameState.table) {
      const minBuyIn = baseUnitsToDisplay(gameState.table.minBuyIn.toNumber(), tableToken);
      const params =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search)
          : null;
      if (params?.get("buyIn")) return;
      // Set to min buy-in if current value is below minimum
      if (buyInSol < minBuyIn) {
        setBuyInSol(minBuyIn);
      }
    }
  }, [gameState.table, buyInSol]);

  // Track phase changes, community cards, and winners for game history
  const prevPhaseRef = useRef(gameState.phase);
  const prevCommunityRef = useRef<number[]>([]);
  const isFirstRenderRef = useRef(true);
  // Track chips before showdown to detect winners
  const chipsBeforeShowdownRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    // Skip logging on first render (initial state)
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevPhaseRef.current = gameState.phase;
      return;
    }

    // Track phase changes
    if (prevPhaseRef.current !== gameState.phase) {
      // Play sounds for phase transitions
      switch (gameState.phase) {
        case "PreFlop":
          playSound("cardDeal");
          break;
        case "Flop":
        case "Turn":
        case "River":
          playSound("cardFlip");
          break;
      }

      // Phase messages - Flop/Turn/River handled by card events, no duplicate messages
      const phaseMessages: Record<string, string | null> = {
        "Dealing": "New hand starting...",
        "PreFlop": "Pre-flop betting",
        "Flop": null,  // Card event will show "Flop: X Y Z"
        "Turn": null,  // Card event will show "Turn: X"
        "River": null, // Card event will show "River: X"
        "Showdown": "Showdown!",
        "Settled": "Hand complete",
      };
      const message = phaseMessages[gameState.phase];

      // When entering Showdown, capture current chip counts
      if (gameState.phase === "Showdown") {
        const chipMap = new Map<number, number>();
        gameState.players.forEach((p) => {
          if (p.status !== "empty") {
            chipMap.set(p.seatIndex, p.chips);
          }
        });
        chipsBeforeShowdownRef.current = chipMap;
      }

      // When settling, detect winners by comparing chips
      if (gameState.phase === "Settled" && chipsBeforeShowdownRef.current.size > 0) {
        const winners: { seatIndex: number; winnings: number; handDesc?: string }[] = [];

        // Get community cards for hand evaluation
        const community = gameState.communityCards
          .map(c => Number(c))
          .filter(c => !isNaN(c) && c !== 255);

        gameState.players.forEach((p) => {
          if (p.status !== "empty") {
            const chipsBefore = chipsBeforeShowdownRef.current.get(p.seatIndex) ?? 0;
            const chipsNow = p.chips;
            if (chipsNow > chipsBefore) {
              // Try to evaluate hand if we have hole cards (only for current player)
              let handDesc: string | undefined;
              if (p.holeCards[0] !== null && p.holeCards[1] !== null && community.length === 5) {
                const allCards = [p.holeCards[0], p.holeCards[1], ...community];
                const evaluated = evaluateHand(allCards);
                handDesc = getHandDescription(evaluated);
              }

              winners.push({
                seatIndex: p.seatIndex,
                winnings: chipsNow - chipsBefore,
                handDesc,
              });
            }
          }
        });

        // Add winner events and trigger chip animations
        winners.forEach((winner, index) => {
          const winningsDisplay = fmt(winner.winnings);
          const handInfo = winner.handDesc ? ` with ${winner.handDesc}` : "";
          addGameEvent("winner", `Seat ${winner.seatIndex + 1} won ${winningsDisplay} ${tableToken.symbol}${handInfo}`, {
            seatIndex: winner.seatIndex,
            amount: winner.winnings,
          });
          // Trigger chip animation from pot to winner (stagger if multiple winners)
          setTimeout(() => {
            triggerWinAnimation(winner.seatIndex);
          }, index * 200);
        });

        // Play win sound and show celebration if current player won
        const currentPlayerSeat = gameState.players.find(p => p.player === publicKey?.toString());
        if (currentPlayerSeat) {
          const playerWin = winners.find(w => w.seatIndex === currentPlayerSeat.seatIndex);
          if (playerWin) {
            playSound("chipWin");
            setCelebrationWinAmount(playerWin.winnings);
            setShowCelebration(true);
          }
        }

        // Clear the chip tracking for next hand
        chipsBeforeShowdownRef.current = new Map();
      }

      // Only add phase event if there's a message (Flop/Turn/River handled by card events)
      if (message) {
        addGameEvent("phase", message);
      }

      // Add separator when new hand starts (don't clear history)
      if (gameState.phase === "Dealing") {
        addGameEvent("system", "━━━━━━ New Hand ━━━━━━");
      }

      prevPhaseRef.current = gameState.phase;
    }

    // Track community card reveals
    // Ensure cards are plain numbers (not BN, buffer values, etc.)
    const currentCommunity = gameState.communityCards
      .map(c => Number(c))
      .filter(c => !isNaN(c) && c !== 255);
    if (currentCommunity.length > prevCommunityRef.current.length) {
      const newCards = currentCommunity.slice(prevCommunityRef.current.length);
      if (newCards.length === 3) {
        addGameEvent("cards", "Flop:", { cards: newCards });
      } else if (newCards.length === 1 && currentCommunity.length === 4) {
        addGameEvent("cards", "Turn:", { cards: newCards });
      } else if (newCards.length === 1 && currentCommunity.length === 5) {
        addGameEvent("cards", "River:", { cards: newCards });
      }
      prevCommunityRef.current = [...currentCommunity];
    }
  }, [gameState.phase, gameState.communityCards, gameState.players, addGameEvent, playSound, publicKey, triggerWinAnimation]);

  // Track bets to trigger chip animations
  useEffect(() => {
    // Skip if no betting is happening
    if (gameState.phase === "Dealing" || gameState.phase === "Settled" || gameState.phase === "Showdown") {
      // Reset bet tracking when hand ends or starts
      if (gameState.phase === "Dealing" || gameState.phase === "Settled") {
        prevBetsRef.current = new Map();
      }
      return;
    }

    // Check each player for bet increases
    gameState.players.forEach((player) => {
      if (player.status === "empty" || player.status === "folded") return;

      const prevBet = prevBetsRef.current.get(player.seatIndex) ?? 0;
      const currentBet = player.currentBet;

      // Trigger animation if bet increased
      if (currentBet > prevBet) {
        const betIncrease = currentBet - prevBet;
        triggerBetAnimation(player.seatIndex, betIncrease);
      }
    });

    // Update previous bets
    const newBets = new Map<number, number>();
    gameState.players.forEach((player) => {
      if (player.status !== "empty") {
        newBets.set(player.seatIndex, player.currentBet);
      }
    });
    prevBetsRef.current = newBets;
  }, [gameState.players, gameState.phase, triggerBetAnimation]);

  // Find current player info
  const currentPlayer = gameState.players.find(
    (p) => p.player === publicKey?.toString()
  );

  // Check if all remaining players are all-in (no more betting possible)
  const activePlayers = gameState.players.filter(
    (p) => p.status === "playing" || p.status === "allin"
  );
  const playersWhoCanBet = activePlayers.filter((p) => p.status === "playing");
  const allPlayersAllIn = activePlayers.length >= 2 && playersWhoCanBet.length === 0;
  const onlyOneCanBet = playersWhoCanBet.length === 1;

  // Player can only act if:
  // - It's their turn
  // - They're not all-in
  // - Game is in betting phase
  // - Not waiting for community cards to be revealed
  const isPlayerTurn =
    currentPlayer &&
    currentPlayer.status === "playing" && // Not all-in or folded
    gameState.currentPlayerSeat !== null &&
    gameState.actionOn === currentPlayer.seatIndex &&
    gameState.phase !== "Dealing" &&
    gameState.phase !== "Showdown" &&
    gameState.phase !== "Settled" &&
    !allPlayersAllIn &&
    !gameState.awaitingCommunityReveal &&
    gameState.decryptedCards[0] !== null; // Don't act until hole cards are on screen

  // Calculate action panel values (never negative)
  const toCall = Math.max(0, gameState.currentBet - (currentPlayer?.currentBet ?? 0));
  const canCheck = toCall <= 0;

  const mpcLabel = gameState.isShuffling
    ? "Shuffling 52 cards in MPC…"
    : gameState.isDecrypting
      ? "Sealing your hole cards…"
      : gameState.isRevealingCommunity
        ? "Board reveal queued…"
        : gameState.isRevealing
          ? "Publishing hands from the sealed deck…"
          : gameState.awaitingCommunityReveal && !gameState.isAuthority
            ? "Waiting for host to reveal the board"
            : null;
  const actionLabel = isPlayerTurn
    ? "Action: You"
    : gameState.phase === "Dealing"
      ? "Waiting to deal in"
      : gameState.awaitingCommunityReveal
        ? "Waiting on the board"
        : `Action: Seat ${(gameState.actionOn ?? 0) + 1}`;

  const autoDealRef = useRef(false);
  useEffect(() => {
    if (!currentPlayer || gameState.currentPlayerSeat === null || !gameState.handState) return;
    if (!gameState.isDeckShuffled) {
      autoDealRef.current = false;
      return;
    }
    const seat = gameState.currentPlayerSeat;
    const queued = ((gameState.handState.dealQueued ?? 0) & (1 << seat)) !== 0;
    if (queued || gameState.isDecrypting || gameState.decryptedCards[0] !== null) return;
    if ((gameState.handState.activePlayers & (1 << seat)) === 0) return;
    if (autoDealRef.current) return;
    autoDealRef.current = true;
    dealMeIn().catch(() => {
      autoDealRef.current = false;
    });
  }, [
    currentPlayer,
    gameState.currentPlayerSeat,
    gameState.handState,
    gameState.isDeckShuffled,
    gameState.isDecrypting,
    gameState.decryptedCards,
    dealMeIn,
  ]);

  // Check if we're in a betting phase (for showing timers)
  const isBettingPhase = ["PreFlop", "Flop", "Turn", "River"].includes(gameState.phase);

  // Play sound when it becomes player's turn
  const wasPlayerTurnRef = useRef(false);
  useEffect(() => {
    if (isPlayerTurn && !wasPlayerTurnRef.current) {
      playSound("yourTurn");
    }
    wasPlayerTurnRef.current = isPlayerTurn ?? false;
  }, [isPlayerTurn, playSound]);

  // Handle player action
  const handleAction = async (action: string, amount?: number) => {
    let actionType: ActionType;
    let actionLabel: string;
    switch (action) {
      case "fold":
        actionType = { type: "fold" };
        actionLabel = "Fold";
        break;
      case "check":
        actionType = { type: "check" };
        actionLabel = "Check";
        break;
      case "call":
        actionType = { type: "call" };
        actionLabel = toCall > 0 ? `Call ${fmt(toCall)} ${tableToken.symbol}` : "Call";
        break;
      case "raise":
        actionType = { type: "raise", amount: amount ?? 0 };
        actionLabel = `Raise to ${fmt(amount ?? 0)} ${tableToken.symbol}`;
        break;
      case "allin":
        actionType = { type: "allIn" };
        actionLabel = "All-In";
        break;
      default:
        return;
    }

    // Play sound for the action
    switch (action) {
      case "fold": playSound("fold"); break;
      case "check": playSound("check"); break;
      case "call": playSound("chipBet"); break;
      case "raise": playSound("chipBet"); break;
      case "allin": playSound("allIn"); break;
    }

    try {
      await withToast(
        () => playerAction(actionType),
        `Submitting ${actionLabel}...`,
        `${actionLabel} confirmed`
      );
      // Log the action to game history (use 1-indexed seats for display)
      const seatLabel = currentPlayer ? `Seat ${currentPlayer.seatIndex + 1}` : "Player";
      addGameEvent("action", `${seatLabel}: ${actionLabel}`, {
        seatIndex: currentPlayer?.seatIndex,
        amount: amount,
      });
    } catch (e) {
      console.error("Action failed:", e);
    }
  };

  // Handle join table. Optional overrides are used by Quick Play auto-join so
  // we don't race the prefill state.
  const handleJoinTable = async (opts?: { seat?: number; buyIn?: number }) => {
    const seat = opts?.seat ?? selectedSeat;
    const buy = opts?.buyIn ?? buyInSol;
    if (seat === null || seat === undefined) return;

    // Check deposit limits
    const buyInBase = displayToBaseUnits(buy, tableToken);
    const { allowed, reason } = checkDepositAllowed(buyInBase);
    if (!allowed) {
      setDepositLimitMsg(reason ?? "Deposit limit exceeded.");
      return;
    }
    setDepositLimitMsg(null);

    try {
      await withToast(
        () => joinTable(seat, buyInBase),
        `Joining table with ${buy} ${tableToken.symbol}...`,
        "Joined table"
      );
      recordDeposit(buyInBase);
      setSelectedSeat(null);
    } catch (e) {
      console.error("Join failed:", e);
    }
  };

  // Quick Play lands with ?buyIn=&seat=&auto=1 after the user already confirmed
  // in the lobby modal. Sit automatically once the table, wallet, and balance
  // are ready. Click-to-sit does not set auto=1 — it only prefills the seat.
  useEffect(() => {
    if (autoJoinLock.current) return;
    if (typeof window === "undefined") return;
    if (!connected || !publicKey) return;
    if (!gameState.table || gameState.tableStatus !== "Waiting") return;
    if (currentPlayer) return;
    if (loading) return;
    if (usdcBalance === null) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("auto") !== "1") return;

    const seat = Number(params.get("seat"));
    const buy = Number(params.get("buyIn"));
    if (!Number.isInteger(seat) || seat < 0) return;
    if (!Number.isFinite(buy) || buy <= 0) return;

    if (seat >= gameState.table.maxPlayers) return;
    if ((Number(gameState.table.occupiedSeats) & (1 << seat)) !== 0) return;

    const minBuy = baseUnitsToDisplay(gameState.table.minBuyIn.toNumber(), tableToken);
    const maxBuy = baseUnitsToDisplay(gameState.table.maxBuyIn.toNumber(), tableToken);
    if (buy < minBuy || buy > maxBuy) return;

    const buyInBase = displayToBaseUnits(buy, tableToken);
    if (usdcBalance < buyInBase) return;
    if (!checkDepositAllowed(buyInBase).allowed) return;

    autoJoinLock.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete("auto");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    void handleJoinTable({ seat, buyIn: buy });
  }, [
    connected,
    publicKey,
    gameState.table,
    gameState.tableStatus,
    gameState.players,
    currentPlayer,
    loading,
    usdcBalance,
    tableToken,
    checkDepositAllowed,
  ]);

  // Map game state players to component format
  // Map game state players to component format (memoized to avoid recalculating every render)
  // Use decrypted cards for current player if available
  // Also include revealed cards for showdown display
  const playersForTable = useMemo(() => {
    return gameState.players.map((p) => {
      const isCurrentPlayer = p.player === publicKey?.toString();
      // If this is the current player and we have decrypted cards, use those
      const holeCards: [number | null, number | null] =
        isCurrentPlayer && gameState.decryptedCards[0] !== null
          ? gameState.decryptedCards
          : p.holeCards;

      return {
        seatIndex: p.seatIndex,
        player: p.player,
        chips: p.chips,
        currentBet: p.currentBet,
        holeCards,
        status: p.status,
        isEncrypted: p.isEncrypted && gameState.decryptedCards[0] === null, // Still encrypted if not decrypted (use === null, not !value, since card 0 is valid)
        // Include revealed cards for showdown display
        revealedCards: p.revealedCards,
        cardsRevealed: p.cardsRevealed,
      };
    });
  }, [gameState.players, gameState.decryptedCards, publicKey]);

  // Determine if we're in showdown display mode (Showdown or Settled with revealed cards)
  const isShowdownPhase = gameState.phase === "Showdown" || gameState.phase === "Settled";

  // Check if all active players have revealed their cards for showdown
  // Active players are those with status "playing" or "allin" (not folded)
  const allPlayersRevealed = useMemo(() => {
    const activePlayers = gameState.players.filter(
      p => p.status === "playing" || p.status === "allin"
    );
    // If no active players, allow showdown (edge case)
    if (activePlayers.length === 0) return true;
    // If only one player remains (everyone else folded), no reveal needed - they win automatically
    if (activePlayers.length === 1) return true;
    // Check if all active players have revealed their cards
    return activePlayers.every(p => p.cardsRevealed);
  }, [gameState.players]);

  // If wallet not connected, show spectator view (read-only, no wallet needed)
  if (!connected) {
    return (
      <main className="min-h-screen relative no-overscroll">
        <RotateDeviceOverlay />
        {/* Header */}
        <header className="glass-dark sticky top-0 z-50 px-3 py-2 sm:px-6 sm:py-4 flex justify-between items-center border-b border-white/5 safe-left safe-right">
          <div className="flex items-center gap-4">
            <Link href="/lobby" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="font-display text-2xl font-bold tracking-wide">
              <span className="text-[var(--text-primary)]">Hidden</span>
              <span className="text-gold-gradient">Hand</span>
            </h1>
            <span
              className={`
                text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider font-semibold
                ${NETWORK === "localnet"
                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                  : "bg-[var(--gold-main)]/20 text-[var(--gold-light)] border border-[var(--gold-main)]/30"
                }
              `}
            >
              {NETWORK}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <SoundToggle />
            <WalletButton className="btn-gold !text-sm !px-5 !py-2.5 !rounded-xl" />
          </div>
        </header>

        <div className="container mx-auto px-4 py-8 pb-32">
          <SpectatorView
            tableId={decodedTableId}
            isConnected={false}
            walletButton={
              <WalletButton className="btn-gold !text-sm !px-6 !py-2.5 !rounded-xl !font-semibold" />
            }
          />
        </div>

        {/* Footer */}
        <footer className="fixed bottom-0 w-full glass-dark py-4 text-center border-t border-white/5">
          <p className="text-[var(--text-muted)] text-sm">
            Privacy poker on Solana
            <span className="mx-2 text-white/10">·</span>
            Powered by{" "}
            <a
              href="https://arcium.com"
              className="text-cyan-400 hover:text-cyan-300 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Arcium MPC
            </a>
            <span className="mx-2 text-white/10">·</span>
            <Link href="/responsible-gaming" className="text-amber-400/60 hover:text-amber-400 transition-colors">
              Responsible Gaming
            </Link>
          </p>
        </footer>
      </main>
    );
  }

  // Self-exclusion: block access when active
  if (isExcluded) {
    return (
      <main className="min-h-screen relative">
        <header className="glass-dark sticky top-0 z-50 px-6 py-4 flex justify-between items-center border-b border-white/5">
          <div className="flex items-center gap-4">
            <Link href="/lobby" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="font-display text-2xl font-bold tracking-wide">
              <span className="text-[var(--text-primary)]">Hidden</span>
              <span className="text-gold-gradient">Hand</span>
            </h1>
          </div>
          <WalletButton className="btn-gold !text-sm !px-5 !py-2.5 !rounded-xl" />
        </header>
        <SelfExclusionBanner timeLeft={exclusionTimeLeft()} />
      </main>
    );
  }

  return (
    <main className={`min-h-screen relative no-overscroll ${isMobileLandscape ? "mobile-landscape-compact" : ""}`}>
      <RotateDeviceOverlay />

      {/* Break reminder toast */}
      {showBreakReminder && (
        <BreakReminder
          sessionTime={formatSessionTime()}
          onDismiss={dismissBreakReminder}
        />
      )}

      {/* Header — compact on mobile landscape */}
      <header className={`glass-dark sticky top-0 z-50 ${isMobileLandscape ? "px-3 py-1.5" : "px-6 py-4"} flex justify-between items-center border-b border-white/5 safe-left safe-right`}>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/lobby" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <h1 className={`font-display ${isMobileLandscape ? "text-lg" : "text-2xl"} font-bold tracking-wide`}>
            <span className="text-[var(--text-primary)]">Hidden</span>
            <span className="text-gold-gradient">Hand</span>
          </h1>
          {!isMobileLandscape && (
            <span
              className={`
                text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider font-semibold
                ${NETWORK === "localnet"
                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                  : "bg-[var(--gold-main)]/20 text-[var(--gold-light)] border border-[var(--gold-main)]/30"
                }
              `}
            >
              {NETWORK}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {!isMobileLandscape && <SessionTimer formattedTime={formatSessionTime()} />}
          <SoundToggle />
          <WalletButton className={`btn-gold !text-sm ${isMobileLandscape ? "!px-3 !py-1.5" : "!px-5 !py-2.5"} !rounded-xl`} />
        </div>
      </header>

      {/* Main content */}
      <div className={`container mx-auto ${isMobileLandscape ? "px-2 py-2 pb-20" : "px-4 py-8 pb-32"}`}>
        {/* Game Interface */}
        <div className="space-y-6">
          {/* Spectator Banner — shown when connected but not seated */}
          {!currentPlayer && gameState.table && (
            <div
              className="glass rounded-2xl overflow-hidden"
              style={{
                borderImage: "linear-gradient(90deg, rgba(212,160,18,0.3), rgba(212,160,18,0.05)) 1",
                borderWidth: "1px",
                borderStyle: "solid",
              }}
            >
              <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg, rgba(212,160,18,0.2) 0%, rgba(212,160,18,0.05) 100%)",
                      border: "1px solid rgba(212,160,18,0.3)",
                    }}
                  >
                    <svg className="w-5 h-5 text-[var(--gold-light)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--gold-light)] font-semibold text-sm">Spectating</span>
                      <span className="text-[var(--text-muted)] text-xs">
                        {gameState.tableStatus === "Playing"
                          ? "— Watch only. Sit when this hand ends."
                          : "— Pick a seat in the join panel to sit down."}
                      </span>
                    </div>
                    <p className="text-[var(--text-muted)] text-xs mt-0.5">
                      Hole cards are sealed in MPC &mdash; only seated players can see their hands
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Table Controls */}
          <div className={`glass rounded-2xl ${isMobileLandscape ? "p-2" : "p-5"}`}>
            <div className={`flex flex-wrap items-center ${isMobileLandscape ? "gap-2" : "gap-4"}`}>
              {/* Table ID display */}
              <div className="flex items-center gap-3">
                <label className="text-[var(--text-muted)] text-sm uppercase tracking-wider">
                  Table
                </label>
                <span className="text-[var(--text-primary)] font-medium text-sm">
                  {decodedTableId}
                </span>
              </div>

              {/* Table loaded state */}
              {!gameState.table ? (
                <div className="glass-dark px-4 py-2 rounded-xl text-sm flex items-center gap-2">
                  <div className="animate-spin h-3 w-3 border-2 border-[var(--text-muted)]/30 border-t-[var(--text-muted)] rounded-full" />
                  <span className="text-[var(--text-muted)]">Loading table...</span>
                </div>
              ) : (
                <>
                  {/* Table status */}
                  <div className="glass-dark px-4 py-2 rounded-xl text-sm flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          gameState.tableStatus === "Playing"
                            ? "bg-[var(--status-active)]"
                            : gameState.tableStatus === "Waiting"
                            ? "bg-[var(--status-warning)]"
                            : "bg-[var(--status-danger)]"
                        }`}
                      />
                      <span className="text-[var(--text-secondary)]">
                        {gameState.tableStatus}
                      </span>
                    </div>
                    <span className="text-[var(--text-muted)]">
                      {gameState.players.filter((p) => p.status !== "empty").length}/
                      {gameState.table.maxPlayers} players
                    </span>
                  </div>

                  {/* Table Info - Buy-in Range */}
                  <div className="glass-dark px-4 py-2 rounded-xl text-sm flex items-center gap-2">
                    <span className="text-[var(--text-muted)]">Buy-in:</span>
                    <span className="text-[var(--text-primary)] font-medium">
                      ${fmt(gameState.table.minBuyIn.toNumber())} - ${fmt(gameState.table.maxBuyIn.toNumber())} {tableToken.symbol}
                    </span>
                  </div>

                  {/* Join if not at table */}
                  {!currentPlayer && gameState.tableStatus === "Waiting" && (
                    <div id="join-panel" className="flex items-center gap-3 flex-wrap">
                      <select
                        value={selectedSeat ?? ""}
                        onChange={(e) =>
                          setSelectedSeat(
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                        className="bg-[var(--bg-dark)] text-[var(--text-primary)] px-4 py-2.5 rounded-xl text-sm border border-white/5"
                      >
                        <option value="">Select seat</option>
                        {gameState.players
                          .filter((p) => p.status === "empty")
                          .map((p) => (
                            <option key={p.seatIndex} value={p.seatIndex}>
                              Seat {p.seatIndex + 1}
                            </option>
                          ))}
                      </select>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={buyInSol}
                          onChange={(e) => setBuyInSol(Number(e.target.value))}
                          min={baseUnitsToDisplay(gameState.table.minBuyIn.toNumber(), tableToken)}
                          max={baseUnitsToDisplay(gameState.table.maxBuyIn.toNumber(), tableToken)}
                          step={0.01}
                          className="bg-[var(--bg-dark)] text-[var(--text-primary)] px-4 py-2.5 rounded-xl text-sm w-24 border border-white/5"
                        />
                        <span className="text-[var(--text-muted)] text-sm">{tableToken.symbol}</span>
                      </div>
                      <button
                        onClick={() => void handleJoinTable()}
                        disabled={loading || selectedSeat === null || buyInSol < baseUnitsToDisplay(gameState.table.minBuyIn.toNumber(), tableToken) || buyInSol > baseUnitsToDisplay(gameState.table.maxBuyIn.toNumber(), tableToken)}
                        className="btn-info px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                      >
                        Join
                      </button>
                      {/* Get USDC button — shows when wallet balance is insufficient for buy-in */}
                      {usdcBalance !== null && usdcBalance < displayToBaseUnits(buyInSol, tableToken) && (
                        <button
                          onClick={() => setShowSwapModal(true)}
                          className="px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 bg-[#2775CA]/20 border border-[#2775CA]/40 text-[#5B9BD5] hover:bg-[#2775CA]/30 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                          </svg>
                          Get {tableToken.symbol}
                        </button>
                      )}
                      {/* Warning if buy-in out of range */}
                      {(buyInSol < baseUnitsToDisplay(gameState.table.minBuyIn.toNumber(), tableToken) || buyInSol > baseUnitsToDisplay(gameState.table.maxBuyIn.toNumber(), tableToken)) && (
                        <span className="text-[var(--status-warning)] text-xs">
                          Buy-in must be {fmt(gameState.table.minBuyIn.toNumber())} - {fmt(gameState.table.maxBuyIn.toNumber())} {tableToken.symbol}
                        </span>
                      )}
                      {/* Balance indicator when insufficient */}
                      {usdcBalance !== null && usdcBalance < displayToBaseUnits(buyInSol, tableToken) && (
                        <span className="text-[var(--status-warning)] text-xs w-full">
                          Balance: {baseUnitsToDisplay(usdcBalance, tableToken).toFixed(2)} {tableToken.symbol} (need {buyInSol.toFixed(2)})
                        </span>
                      )}
                      {depositLimitMsg && (
                        <div className="w-full glass-dark border border-amber-500/30 rounded-xl px-4 py-2 flex items-start gap-2">
                          <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span className="text-amber-300 text-xs">{depositLimitMsg}</span>
                          <button onClick={() => setDepositLimitMsg(null)} className="text-amber-400/60 hover:text-amber-300 ml-auto flex-shrink-0">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Leave table. The program forbids leaving mid-hand (every
                      seated player is a participant once a hand starts), so
                      only offer it while the table is Waiting — otherwise show
                      a hint instead of a button that would just fail. */}
                  {currentPlayer && gameState.tableStatus === "Waiting" && (
                    <button
                      onClick={() => leaveTable()}
                      disabled={loading}
                      className="btn-danger px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                    >
                      Leave Table
                    </button>
                  )}
                  {currentPlayer && gameState.tableStatus === "Playing" && (
                    <Tooltip
                      title="Leaving locked during hand"
                      content="Your stake is part of the current hand. You can leave as soon as the hand settles."
                    >
                      <span className="text-[var(--text-muted)] text-xs cursor-help flex items-center gap-1">
                        Leave available after this hand
                        <InfoIcon />
                      </span>
                    </Tooltip>
                  )}

                  {/* Close inactive table - shows after 1 hour of inactivity */}
                  {gameState.tableStatus === "Waiting" &&
                   gameState.lastReadyTime &&
                   (Date.now() / 1000 - gameState.lastReadyTime) >= TABLE_INACTIVE_TIMEOUT_SECONDS && (
                    <button
                      onClick={async () => {
                        if (confirm("Are you sure you want to close this table? All funds will be returned to players.")) {
                          try {
                            await closeInactiveTable();
                            addGameEvent("system", "Inactive table closed, funds returned to all players");
                          } catch (e) {
                            console.error("Failed to close table:", e);
                          }
                        }
                      }}
                      disabled={loading}
                      className="btn-warning px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Close Inactive Table
                    </button>
                  )}


                  {/* Rebuy message */}
                  {currentPlayer && currentPlayer.chips === 0 && (
                    <div className="glass-dark border border-[var(--status-warning)]/30 rounded-xl px-4 py-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-[var(--status-warning)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="text-[var(--status-warning)] text-sm">No chips!</span>
                      <span className="text-[var(--text-muted)] text-sm">Leave and rejoin to rebuy.</span>
                    </div>
                  )}
                </>
              )}

              {/* Error display */}
              {error && (
                <div className="ml-auto glass-dark border border-[var(--status-danger)]/30 rounded-xl px-4 py-2 flex items-center gap-3">
                  <span className="text-[var(--status-danger)] text-sm">
                    {error.startsWith("WALLET_DISCONNECTED:")
                      ? error.replace("WALLET_DISCONNECTED:", "")
                      : error}
                  </span>
                  {error.startsWith("WALLET_DISCONNECTED:") && (
                    <button
                      onClick={() => disconnect()}
                      className="px-3 py-1 text-xs font-semibold rounded-lg bg-[var(--status-danger)]/20 text-[var(--status-danger)] hover:bg-[var(--status-danger)]/30 transition-colors"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              )}

              {/* Loading indicator */}
              {loading && (
                <div className="ml-auto flex items-center gap-2 text-[var(--text-muted)] text-sm">
                  <div className="animate-spin h-4 w-4 border-2 border-[var(--gold-main)]/30 border-t-[var(--gold-main)] rounded-full" />
                  Processing...
                </div>
              )}
            </div>
          </div>

          {/* Authority Controls */}
          {gameState.isAuthority && gameState.table && (
            <div className="glass border border-[var(--gold-main)]/20 rounded-2xl p-5">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[var(--gold-main)]" />
                  <span className="text-[var(--gold-main)] text-sm font-medium uppercase tracking-wider">
                    Authority Controls
                  </span>
                </div>

                {/* Privacy backend — Arcium MPC is always on (shuffle, deal,
                    and reveals run as MPC circuits; no toggle to disable). */}
                <div className="flex items-center gap-2 glass-dark px-3 py-1.5 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span className="text-cyan-400 text-xs font-medium uppercase tracking-wider">
                    Arcium MPC
                  </span>
                  <span className="text-[var(--text-muted)] text-xs">encrypted &amp; provably fair</span>
                </div>

                {/* Count players with chips */}
                {(() => {
                  const playersWithChips = gameState.players.filter(
                    (p) => p.status !== "empty" && p.chips > 0
                  ).length;
                  const totalPlayers = gameState.players.filter(
                    (p) => p.status !== "empty"
                  ).length;
                  const canStart = playersWithChips >= 2;

                  return (
                    <>
                      {/* Start Hand */}
                      {gameState.tableStatus === "Waiting" && totalPlayers >= 2 && (
                        canStart ? (
                          <button
                            onClick={() => withToast(
                              () => startHand(),
                              "Starting hand...",
                              "Hand started"
                            )}
                            disabled={loading}
                            className="btn-gold px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                          >
                            Start Hand
                          </button>
                        ) : (
                          <span className="text-[var(--status-warning)] text-sm">
                            Need 2+ players with chips ({playersWithChips}/{totalPlayers} have chips)
                          </span>
                        )
                      )}

                      {gameState.phase === "Dealing" && (
                        canStart ? (
                          <>
                            {!gameState.isDeckShuffled && !gameState.isShuffling && (
                              <Tooltip
                                title="Shuffle the deck"
                                content="Shuffles the 52-card deck inside Arcium's MPC network and seals it on-chain as opaque ciphertext — nobody, not even a chain observer, can read it. After this, each player deals themselves in."
                              >
                                <button
                                  onClick={() => {
                                    playSound("shuffle");
                                    withToast(
                                      () => shuffleDeck(),
                                      "Shuffling the deck in MPC…",
                                      "Deck shuffled — each player can deal in"
                                    );
                                  }}
                                  disabled={loading}
                                  className="btn-gold px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  Shuffle deck
                                  <InfoIcon />
                                </button>
                              </Tooltip>
                            )}
                            {gameState.isShuffling && (
                              <div className="flex items-center gap-2 text-purple-400 text-sm">
                                <div className="animate-spin h-4 w-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full" />
                                Shuffling the deck in MPC…
                              </div>
                            )}
                            {gameState.isDeckShuffled && (
                              <div className="flex items-center gap-2 text-green-400 text-sm">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Deck shuffled — each player clicks “Deal me in” below
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-[var(--status-warning)] text-sm">
                            Cannot shuffle — need 2+ players with chips
                          </span>
                        )
                      )}

                      {/* Deck sealed in MPC — Arcium. No separate encrypt/grant
                          steps: cards are sealed by the shuffle circuit and each
                          player deals themselves in (see "Deal me in" below). */}
                      {gameState.isDeckShuffled && (
                        <div className="flex items-center gap-2 glass-dark px-3 py-1.5 rounded-lg border border-cyan-500/30">
                          <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          <span className="text-cyan-400 text-xs font-medium">Deck sealed in MPC</span>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Showdown */}
                {(gameState.phase === "Showdown" ||
                  (gameState.phase === "Settled" && gameState.pot > 0)) && (
                  <>
                    {allPlayersRevealed ? (
                      <button
                        onClick={() => showdown()}
                        disabled={loading}
                        className="btn-gold px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                      >
                        {gameState.phase === "Showdown" ? "Run Showdown" : "Award Pot"}
                      </button>
                    ) : (
                      <div className="glass-dark px-4 py-2.5 rounded-xl text-center">
                        <p className="text-yellow-400 text-sm font-medium">
                          {gameState.isRevealing
                            ? "Revealing hands from the sealed deck…"
                            : "Waiting for hands to be revealed from the sealed deck"}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                          One MPC reveal publishes every remaining hand
                        </p>
                        {/* Last-resort abort once the reveal timeout has passed.
                            The showdown_reveal MPC is re-queueable, so this only
                            fires under a sustained MPC failure; the program
                            refunds every seat's stake (nobody is advantaged). */}
                        {gameState.lastActionTime && (Date.now() / 1000 - gameState.lastActionTime) >= REVEAL_TIMEOUT_SECONDS + 5 && (
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <p className="text-orange-400 text-xs mb-2">
                              Reveal timeout reached — if the MPC reveal won&apos;t complete,
                              anyone can abort the hand and refund all stakes
                            </p>
                            <button
                              onClick={() => withToast(() => timeoutShowdown(), "Aborting stuck hand…", "Hand aborted — all stakes refunded")}
                              disabled={loading}
                              className="btn-danger px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
                            >
                              Abort hand &amp; refund everyone
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Phase indicator */}
                {gameState.tableStatus === "Playing" && (
                  <span className="ml-auto text-[var(--text-muted)] text-sm">
                    Phase: <span className="text-[var(--text-primary)] font-medium">{gameState.phase}</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Start Hand timeout panel for non-authority players */}
          {!gameState.isAuthority && currentPlayer && gameState.table &&
            gameState.tableStatus === "Waiting" &&
            gameState.players.filter((p) => p.status !== "empty" && p.chips > 0).length >= 2 && (
            <AuthorityTimeoutPanel
              lastTimestamp={gameState.lastReadyTime}
              delayBeforeShowing={0}
              timeoutSeconds={ACTION_TIMEOUT_SECONDS}
              waitingMessage="Waiting for authority to start hand..."
              readyMessage="Timeout reached - you can start the hand"
              buttonLabel="Start Hand"
              onAction={() => withToast(() => startHand(), "Starting hand...", "Hand started")}
              isLoading={loading}
            />
          )}

          {/* Waiting-for-shuffle panel for non-authority players. Only while the
              deck is NOT yet shuffled — once it is, the per-player "deal me in"
              button below takes over (each player deals themselves in). */}
          {!gameState.isAuthority && currentPlayer && gameState.table &&
            gameState.phase === "Dealing" && !gameState.isDeckShuffled && (
            <AuthorityTimeoutPanel
              lastTimestamp={gameState.lastActionTime}
              delayBeforeShowing={0}
              timeoutSeconds={DEAL_TIMEOUT_SECONDS}
              waitingMessage="Waiting for authority to shuffle the deck..."
              readyMessage="Timeout reached - you can shuffle the deck"
              buttonLabel="Shuffle Deck"
              onAction={async () => {
                playSound("shuffle");
                return withToast(() => shuffleDeck(), "Shuffling the deck in MPC…", "Deck shuffled — each player can deal in");
              }}
              isLoading={loading}
            />
          )}

          {/* Showdown button for non-authority players (after timeout) */}
          {/* Only show when all players have revealed their cards */}
          {!gameState.isAuthority && currentPlayer && gameState.table &&
            allPlayersRevealed &&
            (gameState.phase === "Showdown" ||
              (gameState.phase === "Settled" && gameState.pot > 0)) && (
            <ShowdownTimeoutPanel
              lastActionTime={gameState.lastActionTime}
              phase={gameState.phase}
              onShowdown={showdown}
              isLoading={loading}
            />
          )}

          {gameState.table && gameState.tableStatus === "Playing" && (
            <GameStatusBar
              phase={gameState.phase}
              potLabel={`${fmt(gameState.pot)} ${tableToken.symbol}`}
              toCallLabel={
                isBettingPhase && toCall > 0
                  ? `${fmt(toCall)} ${tableToken.symbol}`
                  : null
              }
              actionLabel={actionLabel}
              mpcLabel={mpcLabel}
            />
          )}

          {/* Poker table */}
          {gameState.table && (
            <PokerTable
              tableId={gameState.tableId}
              phase={gameState.phase}
              pot={gameState.pot}
              communityCards={gameState.communityCards.length > 0 ? gameState.communityCards : [255, 255, 255, 255, 255]}
              currentBet={gameState.currentBet}
              dealerPosition={gameState.dealerPosition}
              actionOn={gameState.actionOn}
              players={playersForTable}
              currentPlayerAddress={publicKey?.toString() ?? ""}
              smallBlind={gameState.smallBlind}
              bigBlind={gameState.bigBlind}
              isShowdownPhase={isShowdownPhase}
              isDeckShuffled={gameState.isDeckShuffled}
              chipBetTrigger={betTrigger}
              chipWinTrigger={winTrigger}
              showWinCelebration={showCelebration}
              winAmount={celebrationWinAmount}
              token={tableToken}
              playerStatsMap={playerStatsMap}
              onEmptySeatClick={
                connected && !currentPlayer && gameState.tableStatus === "Waiting"
                  ? (seat) => {
                      setSelectedSeat(seat);
                      document.getElementById("join-panel")?.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                    }
                  : undefined
              }
            />
          )}

          {/* Showdown Results Banner - shows after showdown when pot has been distributed */}
          {gameState.phase === "Settled" && gameState.pot === 0 && gameState.players.some(p => p.cardsRevealed) && (
            <div className="max-w-lg mx-auto glass border border-amber-500/30 rounded-2xl p-5 text-center mb-4">
              <div className="flex items-center justify-center gap-3 mb-2">
                <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                <span className="text-amber-300 font-bold text-lg">Showdown Complete</span>
                <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <p className="text-[var(--text-secondary)] text-sm">
                All players&apos; cards are now visible. Review the results above!
              </p>
              <p className="text-[var(--text-muted)] text-xs mt-2">
                Cards will reset when a new hand is started
              </p>
            </div>
          )}

          {/* "Deal me in" button — Arcium MPC deal_to_seat.
              Each seated player runs this themselves (cards seal to their own
              key), after the deck is shuffled. Gate on the on-chain bitmaps:
              show when my seat is active in the hand but NOT yet dealt. (Do NOT
              gate on seat status — the status only flips to Playing *inside*
              deal_to_seat, i.e. the very action this button triggers.) The hand
              advances to PreFlop once every active seat has dealt in. */}
          {currentPlayer && gameState.currentPlayerSeat !== null && gameState.handState &&
           gameState.isDeckShuffled && gameState.decryptedCards[0] === null &&
           gameState.tableStatus === "Playing" &&
           (gameState.handState.activePlayers & (1 << (gameState.currentPlayerSeat ?? 0))) !== 0 &&
           ((gameState.handState.dealQueued ?? 0) & (1 << (gameState.currentPlayerSeat ?? 0))) === 0 && (
            <div className="max-w-md mx-auto glass border border-cyan-500/30 rounded-2xl p-5 text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-cyan-400 font-semibold">
                  Deal yourself in
                </span>
              </div>
              <p className="text-[var(--text-muted)] text-sm mb-4">
                Your hole cards are sealed to your key in MPC. Click to deal them
                to your seat and decrypt them — only you can see them.
              </p>
              {gameState.isDecrypting ? (
                <div className="text-cyan-400 text-sm flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Dealing your cards (MPC, ~15-20s)…
                </div>
              ) : (
                <Tooltip
                  title="🔐 Arcium MPC deal"
                  content="Your two hole cards are dealt from the sealed deck inside Arcium's MPC network and encrypted to your key. Only you can decrypt them — nobody else, not even a chain observer, sees your hand."
                >
                  <button
                    onClick={async () => {
                      try {
                        await dealMeIn();
                        addGameEvent("privacy", "Dealt in via Arcium MPC");
                      } catch (e) {
                        console.error("Deal-in failed:", e);
                      }
                    }}
                    disabled={loading || gameState.isDecrypting}
                    className="btn-info px-6 py-3 rounded-xl font-semibold disabled:opacity-50 flex items-center gap-2 mx-auto"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                    Deal me in
                    <InfoIcon />
                  </button>
                </Tooltip>
              )}
            </div>
          )}

          {/* Queued deal_to_seat; callback (blinds + HoleDealt) has not landed. */}
          {currentPlayer && gameState.currentPlayerSeat !== null && gameState.handState &&
           gameState.decryptedCards[0] === null &&
           ((gameState.handState.dealQueued ?? 0) & (1 << (gameState.currentPlayerSeat ?? 0))) !== 0 &&
           (gameState.handState.dealtPlayers & (1 << (gameState.currentPlayerSeat ?? 0))) === 0 && (
            <div className="max-w-md mx-auto glass border border-cyan-500/30 rounded-2xl p-5 text-center">
              <div className="text-cyan-400 text-sm flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Sealing your hole cards in MPC (~15-20s)…
              </div>
            </div>
          )}

          {/* Dealt on-chain but HoleDealt never landed in this client. Retry
              decrypt only — re-queue is rejected with AlreadyDealt. */}
          {currentPlayer && gameState.currentPlayerSeat !== null && gameState.handState &&
           gameState.isDeckShuffled && gameState.decryptedCards[0] === null &&
           gameState.tableStatus === "Playing" &&
           (gameState.handState.dealtPlayers & (1 << (gameState.currentPlayerSeat ?? 0))) !== 0 && (
            <div className="max-w-md mx-auto glass border border-orange-500/30 rounded-2xl p-5 text-center">
              <p className="text-orange-300 font-semibold mb-2">Hole cards not on this device yet</p>
              <p className="text-[var(--text-muted)] text-sm mb-4">
                You are dealt in on-chain, but this tab never saw the decrypt event.
                Retry decrypt — do not try to deal again.
              </p>
              {gameState.isDecrypting ? (
                <div className="text-cyan-400 text-sm flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Scanning for your sealed cards…
                </div>
              ) : (
                <button
                  onClick={async () => {
                    try {
                      await retryDecrypt();
                      addGameEvent("privacy", "Decrypted hole cards");
                    } catch (e) {
                      console.error("Retry decrypt failed:", e);
                    }
                  }}
                  disabled={loading}
                  className="btn-info px-6 py-3 rounded-xl font-semibold disabled:opacity-50"
                >
                  Retry decrypt
                </button>
              )}
            </div>
          )}

          {/* Waiting on other players to deal themselves in. Shown once I've
              dealt in but the hand can't advance until everyone has. */}
          {gameState.phase === "Dealing" && gameState.isDeckShuffled && gameState.handState &&
           gameState.currentPlayerSeat !== null &&
           gameState.decryptedCards[0] !== null &&
           (gameState.handState.dealtPlayers & (1 << (gameState.currentPlayerSeat ?? 0))) !== 0 &&
           gameState.handState.dealtPlayers !== gameState.handState.activePlayers && (() => {
            const active = gameState.handState.activePlayers;
            const dealt = gameState.handState.dealtPlayers;
            let pending = 0;
            for (let s = 0; s < 8; s++) if ((active & (1 << s)) && !(dealt & (1 << s))) pending++;
            // After the deal timeout, anyone can abort the stuck hand (the AFK
            // player who never dealt in can't be dealt for). Small client buffer
            // over DEAL_TIMEOUT_SECONDS so the on-chain (cluster-time) check passes.
            const elapsed = gameState.lastActionTime ? Date.now() / 1000 - gameState.lastActionTime : 0;
            const canReset = elapsed >= DEAL_TIMEOUT_SECONDS + 5;
            return (
              <div className="max-w-md mx-auto glass border border-purple-500/30 rounded-2xl p-5 text-center">
                <div className="flex items-center justify-center gap-3 mb-1">
                  <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-purple-300 font-semibold">
                    Waiting for {pending} more player{pending > 1 ? "s" : ""} to deal in…
                  </span>
                </div>
                <p className="text-[var(--text-muted)] text-sm">
                  You&apos;re dealt in. The hand starts once everyone has dealt themselves in.
                </p>
                {canReset && (
                  <button
                    onClick={() => withToast(() => timeoutDeal(), "Resetting hand…", "Hand reset — blinds refunded")}
                    disabled={loading}
                    className="mt-4 btn-warning px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 mx-auto"
                  >
                    Reset hand (player didn&apos;t deal in)
                  </button>
                )}
              </div>
            );
          })()}

          {/* Stuck community-card reveal: the reveal_* MPC never completed.
              After REVEAL_TIMEOUT_SECONDS anyone can abort the hand; the program
              refunds every seat's stake (fair for all — nobody is advantaged). */}
          {currentPlayer && gameState.tableStatus === "Playing" &&
           gameState.awaitingCommunityReveal && gameState.phase !== "Showdown" &&
           (gameState.handState?.activeCount ?? 0) > 1 &&
           gameState.lastActionTime &&
           Date.now() / 1000 - gameState.lastActionTime >= REVEAL_TIMEOUT_SECONDS + 5 && (
            <div className="max-w-md mx-auto glass border border-red-500/30 rounded-2xl p-5 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-red-300 font-semibold">Community reveal stuck</span>
              </div>
              <p className="text-[var(--text-muted)] text-sm mb-4">
                The MPC reveal hasn&apos;t completed in over {Math.floor(REVEAL_TIMEOUT_SECONDS / 60)} minutes.
                You can abort this hand — every player&apos;s stake is refunded in full.
              </p>
              <button
                onClick={() => withToast(() => timeoutShowdown(), "Aborting stuck hand…", "Hand aborted — all stakes refunded")}
                disabled={loading}
                className="btn-danger px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 mx-auto"
              >
                Abort hand &amp; refund everyone
              </button>
            </div>
          )}

          {currentPlayer &&
           gameState.phase === "Showdown" &&
           activePlayers.length > 1 && (
            <div className="max-w-md mx-auto glass border border-amber-500/30 rounded-2xl p-5 text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span className="text-amber-300 font-semibold">Showdown</span>
              </div>
              <p className="text-[var(--text-muted)] text-sm mb-4">
                Hands are revealed from the sealed deck. Nobody can swap cards.
              </p>
              {gameState.isRevealing ? (
                <div className="text-amber-400 text-sm flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Revealing hands (MPC, ~15–20s)…
                </div>
              ) : allPlayersRevealed ? (
                <p className="text-green-300 text-sm font-medium">
                  Hands are public. Run showdown to pay the pot.
                </p>
              ) : (
                <Tooltip
                  title="Reveal from the sealed deck"
                  content="Hole cards are revealed straight from the same MXE-sealed deck everyone was dealt from. No one can swap or fake a hand."
                >
                  <button
                    onClick={async () => {
                      try {
                        await revealHands();
                        addGameEvent("cards", "Hands revealed from the sealed deck");
                      } catch (e) {
                        console.error("Reveal failed:", e);
                      }
                    }}
                    disabled={loading}
                    className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-xl font-semibold disabled:opacity-50 flex items-center gap-2 mx-auto transition-colors"
                  >
                    Reveal hands
                    <InfoIcon />
                  </button>
                </Tooltip>
              )}
            </div>
          )}

          {/* All-in indicator */}
          {allPlayersAllIn && gameState.tableStatus === "Playing" &&
           gameState.phase !== "Showdown" && gameState.phase !== "Settled" && (
            <div className="max-w-md mx-auto glass border border-[var(--gold-main)]/30 rounded-2xl p-5 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-[var(--gold-main)] animate-pulse" />
                <span className="text-[var(--gold-light)] font-semibold">
                  All players are all-in!
                </span>
              </div>
              <p className="text-[var(--text-muted)] text-sm">
                Cards running out automatically...
              </p>
            </div>
          )}

          {/* Revealing community cards indicator */}
          {gameState.awaitingCommunityReveal && gameState.tableStatus === "Playing" && (
            <div className="max-w-md mx-auto glass border border-purple-500/30 rounded-2xl p-5 text-center">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-purple-300 font-semibold">
                  {gameState.isRevealingCommunity
                    ? (gameState.phase === "PreFlop" ? "Revealing flop via MPC…" :
                       gameState.phase === "Flop" ? "Revealing turn via MPC…" :
                       gameState.phase === "Turn" ? "Revealing river via MPC…" :
                       "Revealing the board…")
                    : (gameState.isAuthority
                      ? "Host is about to reveal the next street"
                      : "Waiting for the host to reveal the board")}
                </span>
              </div>
              <p className="text-[var(--text-muted)] text-sm">
                {gameState.isRevealingCommunity
                  ? "The board is being revealed from the sealed deck."
                  : "Anyone can take over this reveal if the host is AFK for 60s."}
              </p>
            </div>
          )}

          {/* Action panel */}
          {currentPlayer && gameState.tableStatus === "Playing" && (
            <div className="max-w-lg mx-auto space-y-4">
              {/* Timer - shows when it's player's turn */}
              {isPlayerTurn && (
                <div className="flex justify-center">
                  <div className="glass-dark rounded-2xl px-6 py-4">
                    <ActionTimer
                      lastActionTime={gameState.lastActionTime}
                      isPlayerTurn={isPlayerTurn ?? false}
                    />
                  </div>
                </div>
              )}

              {/* Opponent timer - shows when waiting for another player during betting */}
              {/* Don't show when awaiting community reveal - no one should be acting */}
              {!isPlayerTurn && isBettingPhase && gameState.lastActionTime && !gameState.awaitingCommunityReveal && (
                <OpponentTimer
                  lastActionTime={gameState.lastActionTime}
                  actionOn={gameState.actionOn}
                  onTimeout={async () => {
                    try {
                      await timeoutPlayer();
                    } catch (e) {
                      console.error("Timeout failed:", e);
                    }
                  }}
                  isLoading={loading}
                />
              )}

              {/* Session key status — passive indicator (session auto-created on join) */}
              {!isMobileLandscape && (
                <SessionStatus
                  session={sessionState}
                  onRenewSession={createSession}
                  loading={sessionLoading}
                />
              )}

              <ActionPanel
                isPlayerTurn={isPlayerTurn ?? false}
                canCheck={canCheck}
                toCall={toCall}
                minRaise={gameState.minRaise}
                playerChips={currentPlayer.chips}
                onFold={() => handleAction("fold")}
                onCheck={() => handleAction("check")}
                onCall={() => handleAction("call")}
                onRaise={(amount) => handleAction("raise", amount)}
                onAllIn={() => handleAction("allin")}
                isLoading={loading}
                token={tableToken}
                lastActionTime={isPlayerTurn ? gameState.lastActionTime : null}
                mobile={isMobileLandscape}
              />

            </div>
          )}

          {/* Game History - always visible when there are events */}
          {gameEvents.length > 0 && gameState.table && (
            <div className="max-w-lg mx-auto mt-4">
              <GameHistory events={gameEvents} maxHeight="250px" />
            </div>
          )}

          {/* On-Chain Hand History - shows verified hand results from blockchain events */}
          {gameState.table && (
            <div className="max-w-lg mx-auto mt-4">
              <OnChainHandHistory
                history={onChainHistory}
                handTimelines={handTimelines}
                currentPlayerPubkey={publicKey?.toString()}
                isListening={isHistoryListening}
                loadingHistory={loadingHistory}
              />
            </div>
          )}

          {/* Skeleton poker table while loading */}
          {!gameState.table && loading && (
            <div className="relative w-full max-w-5xl aspect-[16/10] mx-auto">
              {/* Skeleton oval felt */}
              <div
                className="absolute inset-10 rounded-[42%]"
                style={{
                  background: "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 1.5s infinite",
                  border: "2px solid rgba(255,255,255,0.05)",
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="rounded-2xl px-8 py-4"
                    style={{
                      background: "linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.02) 75%)",
                      backgroundSize: "200% 100%",
                      animation: "shimmer 1.5s infinite",
                      width: 160, height: 48,
                    }}
                  />
                </div>
              </div>
              {/* Skeleton seats */}
              {[
                { top: "88%", left: "50%" },
                { top: "72%", left: "12%" },
                { top: "28%", left: "12%" },
                { top: "12%", left: "50%" },
                { top: "28%", left: "88%" },
                { top: "72%", left: "88%" },
              ].map((pos, i) => (
                <div
                  key={i}
                  className="absolute w-28 h-20 rounded-2xl"
                  style={{
                    top: pos.top, left: pos.left,
                    transform: "translate(-50%, -50%)",
                    background: "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)",
                    backgroundSize: "200% 100%",
                    animation: "shimmer 1.5s infinite",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                />
              ))}
            </div>
          )}

          {/* No table message */}
          {!gameState.table && !loading && (
            <div className="text-center py-20">
              <div className="glass inline-block px-8 py-6 rounded-2xl mb-6">
                <p className="text-[var(--text-secondary)] text-lg">
                  Table <span className="text-[var(--text-primary)] font-medium">&quot;{decodedTableId}&quot;</span> doesn&apos;t exist yet.
                </p>
                <p className="text-[var(--text-muted)] text-sm mt-2">
                  Go back to the lobby to create a new table.
                </p>
              </div>
              <div>
                <Link
                  href="/lobby"
                  className="btn-gold px-8 py-4 rounded-xl font-semibold inline-block"
                >
                  Back to Lobby
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer — hidden on mobile landscape when action panel is visible */}
      <footer className={`${isMobileLandscape ? "hidden" : ""} fixed bottom-0 w-full glass-dark py-4 text-center border-t border-white/5 safe-bottom`}>
        <p className="text-[var(--text-muted)] text-xs sm:text-sm">
          Privacy poker on Solana
          <span className="mx-2 text-white/10">·</span>
          Powered by{" "}
          <a
            href="https://arcium.com"
            className="text-cyan-400 hover:text-cyan-300 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Arcium MPC
          </a>
          <span className="mx-2 text-white/10">·</span>
          <Link href="/responsible-gaming" className="text-amber-400/60 hover:text-amber-400 transition-colors">
            Responsible Gaming
          </Link>
        </p>
      </footer>

      {/* Transaction Toasts */}
      <TransactionToast
        transactions={transactions}
        onDismiss={dismissTransaction}
        cluster={NETWORK === "localnet" ? "localnet" : "devnet"}
      />

      {/* Swap Modal (Jupiter Plugin) — for getting USDC before joining */}
      <SwapModal
        isOpen={showSwapModal}
        onClose={() => setShowSwapModal(false)}
        onSuccess={refreshBalance}
        outputMint={tableToken.mint.toBase58()}
      />

    </main>
  );
}
