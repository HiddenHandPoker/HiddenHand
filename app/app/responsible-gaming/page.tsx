"use client";

import { useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "@/components/WalletButton";
import { SoundToggle } from "@/components/SoundToggle";
import { NETWORK } from "@/contexts/WalletProvider";
import { useResponsibleGaming } from "@/hooks/useResponsibleGaming";
import { getDefaultToken, baseUnitsToDisplay, displayToBaseUnits } from "@/lib/tokens";

export default function ResponsibleGamingPage() {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toString() ?? null;
  const token = getDefaultToken();

  const {
    formatSessionTime,
    depositLimits,
    pendingChanges,
    setDepositLimit,
    sessionDeposits,
    dailyDeposits,
    weeklyDeposits,
    isExcluded,
    selfExclude,
    exclusionTimeLeft,
    lossThreshold,
    setLossThreshold,
    resetSession,
  } = useResponsibleGaming(wallet);

  // Form state for deposit limits (display units)
  const [sessionLimitInput, setSessionLimitInput] = useState("");
  const [dailyLimitInput, setDailyLimitInput] = useState("");
  const [weeklyLimitInput, setWeeklyLimitInput] = useState("");
  const [lossThresholdInput, setLossThresholdInput] = useState("");

  // Self-exclusion duration selection
  const [exclusionDuration, setExclusionDuration] = useState<string>("24h");
  const [showExclusionConfirm, setShowExclusionConfirm] = useState(false);

  const fmtBase = (baseUnits: number) =>
    baseUnitsToDisplay(baseUnits, token).toFixed(2);

  const handleSetLimit = (
    field: "session" | "daily" | "weekly",
    inputValue: string
  ) => {
    if (!inputValue.trim()) {
      setDepositLimit(field, null);
      return;
    }
    const displayValue = parseFloat(inputValue);
    if (isNaN(displayValue) || displayValue <= 0) return;
    setDepositLimit(field, displayToBaseUnits(displayValue, token));
  };

  const handleSetLossThreshold = () => {
    if (!lossThresholdInput.trim()) {
      setLossThreshold(null);
      return;
    }
    const displayValue = parseFloat(lossThresholdInput);
    if (isNaN(displayValue) || displayValue <= 0) return;
    setLossThreshold(displayToBaseUnits(displayValue, token));
  };

  const handleSelfExclude = () => {
    const durations: Record<string, number> = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };
    selfExclude(durations[exclusionDuration]);
    setShowExclusionConfirm(false);
  };

  const getPendingFor = (field: "session" | "daily" | "weekly") =>
    pendingChanges.find((p) => p.field === field);

  return (
    <main className="min-h-screen relative">
      {/* Header */}
      <header className="glass-dark sticky top-0 z-50 px-6 py-4 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-4">
          <Link
            href="/lobby"
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </Link>
          <h1 className="font-display text-2xl font-bold tracking-wide">
            <span className="text-[var(--text-primary)]">Hidden</span>
            <span className="text-gold-gradient">Hand</span>
          </h1>
          <span
            className={`text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider font-semibold ${
              NETWORK === "localnet"
                ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                : "bg-[var(--gold-main)]/20 text-[var(--gold-light)] border border-[var(--gold-main)]/30"
            }`}
          >
            {NETWORK}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <SoundToggle />
          <WalletButton className="btn-gold !text-sm !px-5 !py-2.5 !rounded-xl" />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 pb-32 max-w-3xl">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-2">
          Responsible Gaming
        </h2>
        <p className="text-[var(--text-secondary)] text-sm mb-8 leading-relaxed max-w-xl">
          We want your experience to be enjoyable and safe. These tools help you
          stay in control of your play. All settings are stored locally on your
          device.
        </p>

        {/* Info Section */}
        <section className="glass rounded-2xl p-6 mb-6">
          <h3 className="font-display text-lg font-bold text-[var(--text-primary)] mb-3">
            Play Responsibly
          </h3>
          <ul className="space-y-2 text-[var(--text-secondary)] text-sm leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">&#8226;</span>
              Set a budget before you play and stick to it.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">&#8226;</span>
              Take regular breaks — long sessions can affect your judgement.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">&#8226;</span>
              Never chase losses. Walking away is always an option.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">&#8226;</span>
              Only play with money you can afford to lose.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">&#8226;</span>
              If gambling stops being fun, it&apos;s time to stop.
            </li>
          </ul>
        </section>

        {/* Session Timer Section */}
        {wallet && (
          <section className="glass rounded-2xl p-6 mb-6">
            <h3 className="font-display text-lg font-bold text-[var(--text-primary)] mb-1">
              Session Timer
            </h3>
            <p className="text-[var(--text-muted)] text-xs mb-4">
              Tracks how long you&apos;ve been playing. After 2 hours you&apos;ll
              receive a gentle reminder, then every hour after that.
            </p>
            <div className="flex items-center gap-4">
              <div className="glass-dark rounded-xl px-5 py-3">
                <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-1">
                  Current session
                </p>
                <p className="text-[var(--text-primary)] font-display text-xl font-bold font-mono">
                  {formatSessionTime()}
                </p>
              </div>
              <button
                onClick={resetSession}
                className="btn-action px-4 py-2.5 rounded-xl text-sm font-medium"
              >
                Reset Session
              </button>
            </div>
          </section>
        )}

        {/* Deposit Limits Section */}
        {wallet ? (
          <section className="glass rounded-2xl p-6 mb-6">
            <h3 className="font-display text-lg font-bold text-[var(--text-primary)] mb-1">
              Deposit Limits
            </h3>
            <p className="text-[var(--text-muted)] text-xs mb-4">
              Limit how much you can buy in with. Lowering a limit takes effect
              immediately. Raising a limit requires a 24-hour cool-off period.
            </p>

            <div className="space-y-4">
              {(["session", "daily", "weekly"] as const).map((field) => {
                const currentLimit = depositLimits[field];
                const pending = getPendingFor(field);
                const deposited =
                  field === "session"
                    ? sessionDeposits
                    : field === "daily"
                    ? dailyDeposits
                    : weeklyDeposits;
                const inputValue =
                  field === "session"
                    ? sessionLimitInput
                    : field === "daily"
                    ? dailyLimitInput
                    : weeklyLimitInput;
                const setInputValue =
                  field === "session"
                    ? setSessionLimitInput
                    : field === "daily"
                    ? setDailyLimitInput
                    : setWeeklyLimitInput;

                return (
                  <div
                    key={field}
                    className="glass-dark rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[var(--text-primary)] text-sm font-medium capitalize">
                          {field} limit
                        </p>
                        {currentLimit !== null ? (
                          <p className="text-[var(--text-muted)] text-xs mt-0.5">
                            Deposited: {fmtBase(deposited)} / {fmtBase(currentLimit)}{" "}
                            {token.symbol}
                          </p>
                        ) : (
                          <p className="text-[var(--text-muted)] text-xs mt-0.5">
                            No limit set
                          </p>
                        )}
                      </div>
                      {currentLimit !== null && (
                        <div className="flex items-center gap-2">
                          <span className="text-[var(--gold-light)] font-display font-bold text-sm">
                            {fmtBase(currentLimit)} {token.symbol}
                          </span>
                          <button
                            onClick={() => setDepositLimit(field, null)}
                            className="text-[var(--text-muted)] hover:text-[var(--status-danger)] transition-colors text-xs"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Progress bar */}
                    {currentLimit !== null && (
                      <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              (deposited / currentLimit) * 100
                            )}%`,
                            background:
                              deposited / currentLimit > 0.8
                                ? "var(--status-warning)"
                                : "var(--status-active)",
                          }}
                        />
                      </div>
                    )}

                    {pending && (
                      <p className="text-amber-400 text-xs">
                        Pending increase to {fmtBase(pending.newValue)}{" "}
                        {token.symbol} — effective{" "}
                        {new Date(pending.effectiveAt).toLocaleString()}
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder={`Set ${field} limit (${token.symbol})`}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        min={0}
                        step={0.01}
                        className="flex-1 bg-[var(--bg-deep)] text-[var(--text-primary)] px-3 py-2 rounded-lg text-sm border border-white/5 focus:border-amber-500/50"
                      />
                      <button
                        onClick={() => {
                          handleSetLimit(field, inputValue);
                          setInputValue("");
                        }}
                        className="btn-action px-4 py-2 rounded-lg text-sm font-medium"
                      >
                        Set
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="glass rounded-2xl p-6 mb-6">
            <h3 className="font-display text-lg font-bold text-[var(--text-primary)] mb-2">
              Deposit Limits & Session Controls
            </h3>
            <p className="text-[var(--text-muted)] text-sm">
              Connect your wallet to configure deposit limits, session timer, and
              self-exclusion settings.
            </p>
          </section>
        )}

        {/* Loss Threshold Section */}
        {wallet && (
          <section className="glass rounded-2xl p-6 mb-6">
            <h3 className="font-display text-lg font-bold text-[var(--text-primary)] mb-1">
              Loss Alert
            </h3>
            <p className="text-[var(--text-muted)] text-xs mb-4">
              Set a daily loss threshold. If your losses for the day exceed this
              amount, you&apos;ll see a warning in your session.
            </p>

            <div className="glass-dark rounded-xl p-4">
              {lossThreshold.daily !== null ? (
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[var(--text-primary)] text-sm">
                    Alert when daily loss exceeds{" "}
                    <span className="text-amber-400 font-bold">
                      {fmtBase(lossThreshold.daily)} {token.symbol}
                    </span>
                  </p>
                  <button
                    onClick={() => setLossThreshold(null)}
                    className="text-[var(--text-muted)] hover:text-[var(--status-danger)] transition-colors text-xs"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <p className="text-[var(--text-muted)] text-xs mb-3">
                  No loss threshold set
                </p>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder={`Max daily loss (${token.symbol})`}
                  value={lossThresholdInput}
                  onChange={(e) => setLossThresholdInput(e.target.value)}
                  min={0}
                  step={0.01}
                  className="flex-1 bg-[var(--bg-deep)] text-[var(--text-primary)] px-3 py-2 rounded-lg text-sm border border-white/5 focus:border-amber-500/50"
                />
                <button
                  onClick={() => {
                    handleSetLossThreshold();
                    setLossThresholdInput("");
                  }}
                  className="btn-action px-4 py-2 rounded-lg text-sm font-medium"
                >
                  Set
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Self-Exclusion Section */}
        {wallet && (
          <section className="glass rounded-2xl p-6 mb-6 border border-amber-500/10">
            <h3 className="font-display text-lg font-bold text-[var(--text-primary)] mb-1">
              Self-Exclusion
            </h3>
            <p className="text-[var(--text-muted)] text-xs mb-4">
              Take a break from playing. During an exclusion period, you will not
              be able to join any tables. This cannot be reversed early.
            </p>

            {isExcluded ? (
              <div className="glass-dark rounded-xl p-4 border border-amber-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-amber-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-amber-300 text-sm font-medium">
                      Self-exclusion active
                    </p>
                    <p className="text-amber-300/60 text-xs">
                      Time remaining: {exclusionTimeLeft()}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {(["24h", "7d", "30d"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setExclusionDuration(d)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        exclusionDuration === d
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : "bg-[var(--bg-dark)] text-[var(--text-muted)] border border-white/5 hover:border-white/10"
                      }`}
                    >
                      {d === "24h"
                        ? "24 Hours"
                        : d === "7d"
                        ? "7 Days"
                        : "30 Days"}
                    </button>
                  ))}
                </div>

                {showExclusionConfirm ? (
                  <div className="glass-dark rounded-xl p-4 border border-amber-500/30">
                    <p className="text-amber-200 text-sm mb-3">
                      Are you sure? You will not be able to play for{" "}
                      <strong>
                        {exclusionDuration === "24h"
                          ? "24 hours"
                          : exclusionDuration === "7d"
                          ? "7 days"
                          : "30 days"}
                      </strong>
                      . This cannot be reversed.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSelfExclude}
                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-600 text-white hover:bg-amber-500 transition-colors"
                      >
                        Confirm Exclusion
                      </button>
                      <button
                        onClick={() => setShowExclusionConfirm(false)}
                        className="btn-action px-4 py-2 rounded-lg text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowExclusionConfirm(true)}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30 transition-colors"
                  >
                    Self-Exclude
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {/* Help Resources */}
        <section className="glass rounded-2xl p-6 mb-6">
          <h3 className="font-display text-lg font-bold text-[var(--text-primary)] mb-3">
            Need Help?
          </h3>
          <p className="text-[var(--text-secondary)] text-sm mb-4 leading-relaxed">
            If you or someone you know is struggling with problem gambling, these
            organisations offer free, confidential support.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                name: "BeGambleAware",
                url: "https://www.begambleaware.org",
                desc: "UK-based advice and support",
              },
              {
                name: "NCPG",
                url: "https://www.ncpgambling.org",
                desc: "National Council on Problem Gambling (US)",
              },
              {
                name: "GamCare",
                url: "https://www.gamcare.org.uk",
                desc: "Free treatment and support (UK)",
              },
            ].map((org) => (
              <a
                key={org.name}
                href={org.url}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-dark rounded-xl p-4 hover:border-[var(--status-info)]/40 transition-all group"
              >
                <p className="text-[var(--status-info)] text-sm font-semibold group-hover:underline">
                  {org.name}
                </p>
                <p className="text-[var(--text-muted)] text-xs mt-1">
                  {org.desc}
                </p>
              </a>
            ))}
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 w-full glass-dark py-4 text-center border-t border-white/5">
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/lobby"
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm transition-colors"
          >
            Lobby
          </Link>
          <span className="text-white/10">|</span>
          <span className="text-amber-400/80 text-sm font-medium">
            Responsible Gaming
          </span>
        </div>
      </footer>
    </main>
  );
}
