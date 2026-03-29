"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ─── Constants ───

const STORAGE_PREFIX = "hh_rg_";
const SESSION_REMINDER_HOURS = 2;
const SESSION_REMINDER_INTERVAL_HOURS = 1;
const LIMIT_COOLOFF_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Types ───

export interface DepositLimits {
  session: number | null; // max USDC per session (base units)
  daily: number | null;
  weekly: number | null;
}

export interface PendingLimitChange {
  field: keyof DepositLimits;
  newValue: number;
  effectiveAt: number; // Unix ms timestamp
}

export interface SelfExclusion {
  until: number; // Unix ms timestamp
}

export interface SessionData {
  startedAt: number; // Unix ms
  totalDeposited: number; // base units deposited this session
}

export interface DailyDeposits {
  date: string; // YYYY-MM-DD
  total: number; // base units
}

export interface WeeklyDeposits {
  weekStart: string; // YYYY-MM-DD (Monday)
  total: number; // base units
}

export interface LossThreshold {
  daily: number | null; // base units, user-defined max daily loss
}

// ─── Storage helpers ───

function storageKey(wallet: string, suffix: string): string {
  return `${STORAGE_PREFIX}${wallet.slice(0, 8)}_${suffix}`;
}

function loadJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveJSON<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage full — silently fail
  }
}

// ─── Date helpers ───

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function weekStartKey(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = 0
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - diff);
  return monday.toISOString().slice(0, 10);
}

// ─── Hook ───

export function useResponsibleGaming(walletAddress: string | null) {
  // Session timer
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [sessionElapsedMs, setSessionElapsedMs] = useState(0);
  const [showBreakReminder, setShowBreakReminder] = useState(false);
  const [lastReminderDismissedAt, setLastReminderDismissedAt] = useState<number>(0);

  // Deposit limits
  const [depositLimits, setDepositLimitsState] = useState<DepositLimits>({
    session: null,
    daily: null,
    weekly: null,
  });
  const [pendingChanges, setPendingChangesState] = useState<PendingLimitChange[]>([]);

  // Self-exclusion
  const [selfExclusion, setSelfExclusionState] = useState<SelfExclusion | null>(null);

  // Session deposits tracking
  const [sessionDeposits, setSessionDeposits] = useState(0);
  const [dailyDeposits, setDailyDeposits] = useState(0);
  const [weeklyDeposits, setWeeklyDeposits] = useState(0);

  // Loss threshold
  const [lossThreshold, setLossThresholdState] = useState<LossThreshold>({ daily: null });

  // Ref to track if we've initialized
  const initializedRef = useRef(false);

  // ─── Load from localStorage when wallet changes ───
  useEffect(() => {
    if (!walletAddress) {
      setSessionStartedAt(null);
      setSessionElapsedMs(0);
      initializedRef.current = false;
      return;
    }

    // Load deposit limits
    const limits = loadJSON<DepositLimits>(storageKey(walletAddress, "limits"));
    if (limits) setDepositLimitsState(limits);

    // Load and apply pending changes
    const pending = loadJSON<PendingLimitChange[]>(storageKey(walletAddress, "pending_limits")) || [];
    const now = Date.now();
    const stillPending: PendingLimitChange[] = [];
    let updatedLimits = limits || { session: null, daily: null, weekly: null };

    for (const change of pending) {
      if (change.effectiveAt <= now) {
        // Apply the change
        updatedLimits = { ...updatedLimits, [change.field]: change.newValue };
      } else {
        stillPending.push(change);
      }
    }

    if (pending.length !== stillPending.length) {
      // Some changes were applied
      setDepositLimitsState(updatedLimits);
      saveJSON(storageKey(walletAddress, "limits"), updatedLimits);
      saveJSON(storageKey(walletAddress, "pending_limits"), stillPending);
    }
    setPendingChangesState(stillPending);

    // Load self-exclusion
    const exclusion = loadJSON<SelfExclusion>(storageKey(walletAddress, "exclusion"));
    if (exclusion && exclusion.until > now) {
      setSelfExclusionState(exclusion);
    } else if (exclusion) {
      // Expired — clear it
      localStorage.removeItem(storageKey(walletAddress, "exclusion"));
      setSelfExclusionState(null);
    }

    // Load deposit tracking
    const daily = loadJSON<DailyDeposits>(storageKey(walletAddress, "daily_deposits"));
    if (daily && daily.date === todayKey()) {
      setDailyDeposits(daily.total);
    } else {
      setDailyDeposits(0);
    }

    const weekly = loadJSON<WeeklyDeposits>(storageKey(walletAddress, "weekly_deposits"));
    if (weekly && weekly.weekStart === weekStartKey()) {
      setWeeklyDeposits(weekly.total);
    } else {
      setWeeklyDeposits(0);
    }

    // Load loss threshold
    const threshold = loadJSON<LossThreshold>(storageKey(walletAddress, "loss_threshold"));
    if (threshold) setLossThresholdState(threshold);

    // Start session timer
    const existingSession = loadJSON<SessionData>(storageKey(walletAddress, "session"));
    if (existingSession) {
      setSessionStartedAt(existingSession.startedAt);
      setSessionDeposits(existingSession.totalDeposited);
    } else {
      const startTime = Date.now();
      setSessionStartedAt(startTime);
      setSessionDeposits(0);
      saveJSON(storageKey(walletAddress, "session"), {
        startedAt: startTime,
        totalDeposited: 0,
      });
    }

    initializedRef.current = true;
  }, [walletAddress]);

  // ─── Session timer tick ───
  useEffect(() => {
    if (!sessionStartedAt) return;

    const tick = () => {
      const elapsed = Date.now() - sessionStartedAt;
      setSessionElapsedMs(elapsed);

      // Check if we should show a break reminder
      const elapsedHours = elapsed / (1000 * 60 * 60);
      if (elapsedHours >= SESSION_REMINDER_HOURS) {
        const timeSinceLastDismiss = Date.now() - lastReminderDismissedAt;
        const dismissIntervalMs = SESSION_REMINDER_INTERVAL_HOURS * 60 * 60 * 1000;
        if (lastReminderDismissedAt === 0 || timeSinceLastDismiss >= dismissIntervalMs) {
          setShowBreakReminder(true);
        }
      }
    };

    tick();
    const id = setInterval(tick, 60_000); // Update every minute
    return () => clearInterval(id);
  }, [sessionStartedAt, lastReminderDismissedAt]);

  // ─── Format session time ───
  const formatSessionTime = useCallback((): string => {
    const totalMinutes = Math.floor(sessionElapsedMs / 60_000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
    return `${minutes}m`;
  }, [sessionElapsedMs]);

  // ─── Dismiss break reminder ───
  const dismissBreakReminder = useCallback(() => {
    setShowBreakReminder(false);
    setLastReminderDismissedAt(Date.now());
  }, []);

  // ─── Reset session (when player leaves all tables) ───
  const resetSession = useCallback(() => {
    if (!walletAddress) return;
    const startTime = Date.now();
    setSessionStartedAt(startTime);
    setSessionElapsedMs(0);
    setSessionDeposits(0);
    setShowBreakReminder(false);
    setLastReminderDismissedAt(0);
    saveJSON(storageKey(walletAddress, "session"), {
      startedAt: startTime,
      totalDeposited: 0,
    });
  }, [walletAddress]);

  // ─── Deposit limit management ───
  const setDepositLimit = useCallback(
    (field: keyof DepositLimits, value: number | null) => {
      if (!walletAddress) return;

      const currentValue = depositLimits[field];

      // Lowering or removing is instant
      if (value === null || currentValue === null || value <= currentValue) {
        const newLimits = { ...depositLimits, [field]: value };
        setDepositLimitsState(newLimits);
        saveJSON(storageKey(walletAddress, "limits"), newLimits);

        // Remove any pending change for this field
        const newPending = pendingChanges.filter((p) => p.field !== field);
        setPendingChangesState(newPending);
        saveJSON(storageKey(walletAddress, "pending_limits"), newPending);
        return;
      }

      // Raising requires 24h cool-off
      const change: PendingLimitChange = {
        field,
        newValue: value,
        effectiveAt: Date.now() + LIMIT_COOLOFF_MS,
      };

      // Replace any existing pending change for this field
      const newPending = [...pendingChanges.filter((p) => p.field !== field), change];
      setPendingChangesState(newPending);
      saveJSON(storageKey(walletAddress, "pending_limits"), newPending);
    },
    [walletAddress, depositLimits, pendingChanges]
  );

  // ─── Check if a deposit is allowed ───
  const checkDepositAllowed = useCallback(
    (amount: number): { allowed: boolean; reason?: string } => {
      // Check session limit
      if (depositLimits.session !== null) {
        if (sessionDeposits + amount > depositLimits.session) {
          return {
            allowed: false,
            reason: `This buy-in would exceed your session deposit limit. You've deposited ${sessionDeposits} of ${depositLimits.session} allowed this session.`,
          };
        }
      }

      // Check daily limit
      if (depositLimits.daily !== null) {
        if (dailyDeposits + amount > depositLimits.daily) {
          return {
            allowed: false,
            reason: `This buy-in would exceed your daily deposit limit. You've deposited ${dailyDeposits} of ${depositLimits.daily} allowed today.`,
          };
        }
      }

      // Check weekly limit
      if (depositLimits.weekly !== null) {
        if (weeklyDeposits + amount > depositLimits.weekly) {
          return {
            allowed: false,
            reason: `This buy-in would exceed your weekly deposit limit. You've deposited ${weeklyDeposits} of ${depositLimits.weekly} allowed this week.`,
          };
        }
      }

      return { allowed: true };
    },
    [depositLimits, sessionDeposits, dailyDeposits, weeklyDeposits]
  );

  // ─── Record a deposit ───
  const recordDeposit = useCallback(
    (amount: number) => {
      if (!walletAddress) return;

      // Session
      const newSessionDeposits = sessionDeposits + amount;
      setSessionDeposits(newSessionDeposits);
      saveJSON(storageKey(walletAddress, "session"), {
        startedAt: sessionStartedAt,
        totalDeposited: newSessionDeposits,
      });

      // Daily
      const newDailyDeposits = dailyDeposits + amount;
      setDailyDeposits(newDailyDeposits);
      saveJSON(storageKey(walletAddress, "daily_deposits"), {
        date: todayKey(),
        total: newDailyDeposits,
      });

      // Weekly
      const newWeeklyDeposits = weeklyDeposits + amount;
      setWeeklyDeposits(newWeeklyDeposits);
      saveJSON(storageKey(walletAddress, "weekly_deposits"), {
        weekStart: weekStartKey(),
        total: newWeeklyDeposits,
      });
    },
    [walletAddress, sessionDeposits, dailyDeposits, weeklyDeposits, sessionStartedAt]
  );

  // ─── Self-exclusion ───
  const selfExclude = useCallback(
    (durationMs: number) => {
      if (!walletAddress) return;
      const exclusion: SelfExclusion = { until: Date.now() + durationMs };
      setSelfExclusionState(exclusion);
      saveJSON(storageKey(walletAddress, "exclusion"), exclusion);
    },
    [walletAddress]
  );

  const isExcluded = selfExclusion !== null && selfExclusion.until > Date.now();

  const exclusionTimeLeft = useCallback((): string => {
    if (!selfExclusion) return "";
    const remaining = selfExclusion.until - Date.now();
    if (remaining <= 0) return "";
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }, [selfExclusion]);

  // ─── Loss threshold ───
  const setLossThreshold = useCallback(
    (value: number | null) => {
      if (!walletAddress) return;
      const threshold: LossThreshold = { daily: value };
      setLossThresholdState(threshold);
      saveJSON(storageKey(walletAddress, "loss_threshold"), threshold);
    },
    [walletAddress]
  );

  return {
    // Session timer
    sessionElapsedMs,
    formatSessionTime,
    showBreakReminder,
    dismissBreakReminder,
    resetSession,

    // Deposit limits
    depositLimits,
    pendingChanges,
    setDepositLimit,
    checkDepositAllowed,
    recordDeposit,
    sessionDeposits,
    dailyDeposits,
    weeklyDeposits,

    // Self-exclusion
    isExcluded,
    selfExclusion,
    selfExclude,
    exclusionTimeLeft,

    // Loss threshold
    lossThreshold,
    setLossThreshold,
  };
}
