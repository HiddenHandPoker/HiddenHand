"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  HandHistoryEntry,
  TimelineEvent,
  HandStartedTimelineEvent,
  PHASE_NAMES,
  ACTION_NAMES,
  formatCard,
} from "@/hooks/useHandHistory";
import { type TokenInfo, baseUnitsToDisplay } from "@/lib/tokens";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReplayPlayerState {
  seatIndex: number;
  player: string;
  chips: number;
  currentBet: number;
  holeCards: [number | null, number | null];
  status: "empty" | "sitting" | "playing" | "folded" | "allin";
  /** Cards have been cryptographically revealed at showdown */
  isRevealed: boolean;
  /** Hand rank string from HandCompleted (only set at final step) */
  handRank: string | null;
  /** Amount won (only set at final step) */
  chipsWon: number;
}

export interface ReplayTableState {
  phase: string;
  pot: number;
  communityCards: number[];
  dealerPosition: number;
  actionOn: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  smallBlind: number;
  bigBlind: number;
  players: ReplayPlayerState[];
  /** Whether this is the final (HandCompleted) step */
  isFinalStep: boolean;
  /** Seats that won the hand (only on final step) */
  winnerSeats: number[];
}

export type SpeedMultiplier = 0.5 | 1 | 2;

export interface ReplayState {
  /** Current step index (0-based) */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
  /** Whether auto-play is active */
  isPlaying: boolean;
  /** Playback speed multiplier */
  speed: SpeedMultiplier;
  /** Derived table state at the current step */
  tableState: ReplayTableState;
  /** The current step's event (for annotation) */
  currentEvent: TimelineEvent | "hand_completed" | null;
  /** Human-readable annotation for the current step */
  annotation: string;
}

// ---------------------------------------------------------------------------
// Step types — a "step" is either a timeline event or the final HandCompleted
// ---------------------------------------------------------------------------

type ReplayStep =
  | { kind: "timeline"; event: TimelineEvent }
  | { kind: "completed"; hand: HandHistoryEntry };

// ---------------------------------------------------------------------------
// Build the ordered step list from timeline + hand result
// ---------------------------------------------------------------------------

function buildSteps(
  timeline: TimelineEvent[],
  hand: HandHistoryEntry,
): ReplayStep[] {
  // Timeline events are already in chronological order from the hook
  const steps: ReplayStep[] = timeline.map((event) => ({
    kind: "timeline" as const,
    event,
  }));
  // Final step: the completed hand (winner announcement)
  steps.push({ kind: "completed" as const, hand });
  return steps;
}

// ---------------------------------------------------------------------------
// Build initial player roster from HandStarted + HandCompleted
// ---------------------------------------------------------------------------

function buildInitialPlayers(
  hand: HandHistoryEntry,
  startEvent?: HandStartedTimelineEvent,
): ReplayPlayerState[] {
  // We always have HandCompleted data with player info.
  // Use active_players bitmap from HandStarted if available for accurate seating.
  const players: ReplayPlayerState[] = [];

  for (let seat = 0; seat < 6; seat++) {
    const result = hand.players.find((p) => p.seatIndex === seat);
    if (result) {
      players.push({
        seatIndex: seat,
        player: result.player,
        // Starting chips = chipsWon - chipsBet + chipsBet = approximate
        // We reconstruct starting stack as: final_chips_won + chips_bet (what they started with is unknown exactly,
        // but chipsBet is what they put in and chipsWon is what they got back)
        chips: result.chipsBet + result.chipsWon, // Best approximation of starting stack
        currentBet: 0,
        holeCards: [null, null],
        status: "playing",
        isRevealed: false,
        handRank: null,
        chipsWon: 0,
      });
    } else {
      players.push({
        seatIndex: seat,
        player: "",
        chips: 0,
        currentBet: 0,
        holeCards: [null, null],
        status: "empty",
        isRevealed: false,
        handRank: null,
        chipsWon: 0,
      });
    }
  }

  return players;
}

// ---------------------------------------------------------------------------
// Apply a single step to produce the next table state
// ---------------------------------------------------------------------------

function applyStep(
  prev: ReplayTableState,
  step: ReplayStep,
): ReplayTableState {
  const next: ReplayTableState = {
    ...prev,
    players: prev.players.map((p) => ({ ...p })),
    communityCards: [...prev.communityCards],
    isFinalStep: false,
    winnerSeats: [],
  };

  if (step.kind === "timeline") {
    const event = step.event;

    switch (event.type) {
      case "hand_started": {
        next.phase = "PreFlop";
        next.dealerPosition = event.dealerPosition;
        next.smallBlindSeat = event.smallBlindSeat;
        next.bigBlindSeat = event.bigBlindSeat;
        next.smallBlind = event.smallBlindAmount;
        next.bigBlind = event.bigBlindAmount;
        // Post blinds
        const sbPlayer = next.players.find(
          (p) => p.seatIndex === event.smallBlindSeat,
        );
        const bbPlayer = next.players.find(
          (p) => p.seatIndex === event.bigBlindSeat,
        );
        if (sbPlayer && sbPlayer.status !== "empty") {
          sbPlayer.currentBet = event.smallBlindAmount;
          sbPlayer.chips -= event.smallBlindAmount;
        }
        if (bbPlayer && bbPlayer.status !== "empty") {
          bbPlayer.currentBet = event.bigBlindAmount;
          bbPlayer.chips -= event.bigBlindAmount;
        }
        next.pot = event.smallBlindAmount + event.bigBlindAmount;
        // First to act is after BB
        next.actionOn = 255; // Will be set by first ActionTaken
        break;
      }

      case "action_taken": {
        const phaseName = PHASE_NAMES[event.phase] || "PreFlop";
        next.phase = phaseName;
        next.pot = event.potAfter;
        next.actionOn = event.nextActionOn;

        const actor = next.players.find(
          (p) => p.seatIndex === event.seatIndex,
        );
        if (actor) {
          if (event.actionType === 0 || event.actionType === 5) {
            // Fold or Timeout Fold
            actor.status = "folded";
            actor.currentBet = 0;
          } else if (event.actionType === 4) {
            // All-In
            actor.status = "allin";
            actor.chips = 0;
            actor.currentBet += event.amount;
          } else {
            // Check, Call, Raise
            actor.chips -= event.amount;
            actor.currentBet += event.amount;
          }
        }
        break;
      }

      case "community_cards": {
        const phaseName = PHASE_NAMES[event.newPhase] || "Flop";
        next.phase = phaseName;
        // Add new community cards
        next.communityCards = [...prev.communityCards, ...event.cards];
        next.actionOn = event.actionOn;
        // Reset per-street bets for new betting round
        next.players.forEach((p) => {
          if (p.status !== "empty" && p.status !== "folded") {
            p.currentBet = 0;
          }
        });
        break;
      }

      case "showdown_reveal": {
        next.phase = "Showdown";
        const revealer = next.players.find(
          (p) => p.seatIndex === event.seatIndex,
        );
        if (revealer) {
          revealer.holeCards = [event.card1, event.card2];
          revealer.isRevealed = true;
        }
        break;
      }
    }
  } else {
    // HandCompleted — final step
    next.phase = "Settled";
    next.isFinalStep = true;
    next.pot = 0; // Pot has been distributed

    const winnerSeats: number[] = [];
    for (const result of step.hand.players) {
      const p = next.players.find((pl) => pl.seatIndex === result.seatIndex);
      if (p) {
        p.chipsWon = result.chipsWon;
        p.handRank = result.handRank;
        if (result.chipsWon > 0) {
          p.chips += result.chipsWon;
          winnerSeats.push(result.seatIndex);
        }
        if (result.holeCards) {
          p.holeCards = result.holeCards;
          p.isRevealed = true;
        }
      }
    }
    next.winnerSeats = winnerSeats;
    next.communityCards = step.hand.communityCards;
  }

  return next;
}

// ---------------------------------------------------------------------------
// Build annotation string for a step
// ---------------------------------------------------------------------------

function getAnnotation(
  step: ReplayStep,
  token: TokenInfo,
): string {
  const fmt = (v: number) => baseUnitsToDisplay(v, token).toFixed(2);

  if (step.kind === "completed") {
    const winners = step.hand.players.filter((p) => p.chipsWon > 0);
    if (winners.length === 0) return "Hand complete";
    return winners
      .map(
        (w) =>
          `Seat ${w.seatIndex + 1} wins ${fmt(w.chipsWon)} ${token.symbol}${w.handRank ? ` with ${w.handRank}` : ""}`,
      )
      .join(" | ");
  }

  const event = step.event;

  switch (event.type) {
    case "hand_started":
      return `Hand started — Dealer seat ${event.dealerPosition + 1}, Blinds ${fmt(event.smallBlindAmount)}/${fmt(event.bigBlindAmount)} ${token.symbol}`;

    case "action_taken": {
      const phase = PHASE_NAMES[event.phase] || "?";
      const action = ACTION_NAMES[event.actionType] || "?";
      const amount =
        event.amount > 0 ? ` ${fmt(event.amount)} ${token.symbol}` : "";
      return `[${phase}] Seat ${event.seatIndex + 1}: ${action}${amount}`;
    }

    case "community_cards": {
      const phase = PHASE_NAMES[event.newPhase] || "?";
      const cards = event.cards.map(formatCard).join(" ");
      return `${phase} dealt: ${cards}`;
    }

    case "showdown_reveal": {
      const cards = `${formatCard(event.card1)} ${formatCard(event.card2)}`;
      return `Seat ${event.seatIndex + 1} reveals: ${cards}`;
    }
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useReplayState(
  hand: HandHistoryEntry,
  timeline: TimelineEvent[],
  token: TokenInfo,
) {
  const steps = useMemo(() => buildSteps(timeline, hand), [timeline, hand]);
  const totalSteps = steps.length;

  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<SpeedMultiplier>(1);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Precompute all table states so stepping backward is instant
  const allStates = useMemo(() => {
    const initialPlayers = buildInitialPlayers(
      hand,
      timeline.find((e) => e.type === "hand_started") as
        | HandStartedTimelineEvent
        | undefined,
    );

    const initial: ReplayTableState = {
      phase: "Dealing",
      pot: 0,
      communityCards: [],
      dealerPosition: 0,
      actionOn: 255,
      smallBlindSeat: 0,
      bigBlindSeat: 0,
      smallBlind: 0,
      bigBlind: 0,
      players: initialPlayers,
      isFinalStep: false,
      winnerSeats: [],
    };

    const states: ReplayTableState[] = [initial];
    let current = initial;
    for (const step of steps) {
      current = applyStep(current, step);
      states.push(current);
    }
    return states;
  }, [steps, hand, timeline]);

  // tableState at current step: step 0 = after first event applied
  // Index 0 in allStates = initial (before any events)
  // Index N = after step N-1
  const tableState = allStates[currentStep + 1] ?? allStates[allStates.length - 1];
  const currentEvent =
    currentStep < steps.length
      ? steps[currentStep].kind === "timeline"
        ? (steps[currentStep] as { kind: "timeline"; event: TimelineEvent }).event
        : ("hand_completed" as const)
      : null;
  const annotation =
    currentStep < steps.length
      ? getAnnotation(steps[currentStep], token)
      : "";

  // Transport controls
  const goToStep = useCallback(
    (step: number) => {
      setCurrentStep(Math.max(0, Math.min(step, totalSteps - 1)));
    },
    [totalSteps],
  );

  const stepForward = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
  }, [totalSteps]);

  const stepBackward = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const jumpToStart = useCallback(() => {
    setCurrentStep(0);
    setIsPlaying(false);
  }, []);

  const jumpToEnd = useCallback(() => {
    setCurrentStep(totalSteps - 1);
    setIsPlaying(false);
  }, [totalSteps]);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      if (!prev && currentStep >= totalSteps - 1) {
        // If at end, restart from beginning
        setCurrentStep(0);
      }
      return !prev;
    });
  }, [currentStep, totalSteps]);

  const setPlaybackSpeed = useCallback((s: SpeedMultiplier) => {
    setSpeed(s);
  }, []);

  // Auto-advance timer
  useEffect(() => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }

    if (!isPlaying) return;

    if (currentStep >= totalSteps - 1) {
      setIsPlaying(false);
      return;
    }

    const baseDelay = 1500; // 1.5s at 1x
    const delay = baseDelay / speed;

    intervalRef.current = setTimeout(() => {
      setCurrentStep((prev) => {
        const next = prev + 1;
        if (next >= totalSteps - 1) {
          setIsPlaying(false);
        }
        return Math.min(next, totalSteps - 1);
      });
    }, delay);

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, currentStep, totalSteps, speed]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          e.preventDefault();
          stepForward();
          break;
        case "ArrowLeft":
          e.preventDefault();
          stepBackward();
          break;
        case "Home":
          e.preventDefault();
          jumpToStart();
          break;
        case "End":
          e.preventDefault();
          jumpToEnd();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay, stepForward, stepBackward, jumpToStart, jumpToEnd]);

  return {
    currentStep,
    totalSteps,
    isPlaying,
    speed,
    tableState,
    currentEvent,
    annotation,
    // Controls
    goToStep,
    stepForward,
    stepBackward,
    jumpToStart,
    jumpToEnd,
    togglePlay,
    setPlaybackSpeed,
  };
}
