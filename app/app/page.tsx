"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { WalletButton } from "@/components/WalletButton";
import { SoundToggle } from "@/components/SoundToggle";
import { NETWORK } from "@/contexts/WalletProvider";

export default function Home() {
  const { connected } = useWallet();
  const router = useRouter();

  // Redirect to lobby when wallet is connected
  useEffect(() => {
    if (connected) {
      router.push("/lobby");
    }
  }, [connected, router]);

  return (
    <main className="min-h-screen relative overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 px-6 py-4 flex justify-between items-center border-b border-white/5 bg-[var(--bg-deep)]/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-bold tracking-wide">
            <span className="text-[var(--text-primary)]">Hidden</span>
            <span className="text-gold-gradient">Hand</span>
          </h1>
          <span
            className={`
              text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider font-medium
              ${NETWORK === "localnet"
                ? "bg-purple-500/10 text-purple-400/70 border border-purple-500/20"
                : "bg-[var(--gold-main)]/10 text-[var(--gold-main)]/60 border border-[var(--gold-main)]/15"
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

      {/* ===== HERO SECTION ===== */}
      <section className="relative pt-16 sm:pt-24 pb-8 sm:pb-12">
        {/* Subtle ambient glow — felt green, not flashy */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at center, rgba(20, 90, 50, 0.12) 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />

        <div className="relative z-10 max-w-2xl mx-auto px-6 text-center">
          <h2
            className="font-display text-5xl sm:text-6xl md:text-7xl font-bold text-[var(--text-primary)] leading-[1.05] mb-6"
            style={{ opacity: 0, animation: "fade-in-up 0.8s ease-out 0.1s forwards" }}
          >
            Don&apos;t Trust
            <br />
            <span className="text-gold-gradient inline-block">the Dealer</span>
          </h2>

          <p
            className="text-lg sm:text-xl text-[var(--text-secondary)] mb-10 leading-relaxed max-w-lg mx-auto"
            style={{ opacity: 0, animation: "fade-in-up 0.8s ease-out 0.3s forwards" }}
          >
            The only poker game where the house can&apos;t see your cards.
          </p>

          <div
            className="flex flex-col items-center gap-4"
            style={{ opacity: 0, animation: "fade-in-up 0.8s ease-out 0.5s forwards" }}
          >
            <WalletButton className="btn-gold !text-base !px-10 !py-3.5 !rounded-xl !font-bold !w-full sm:!w-auto" />
            <a
              href="/lobby"
              className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors flex items-center gap-1.5"
            >
              Browse tables without a wallet
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>

        {/* Credibility bar */}
        <div
          className="relative z-10 mt-14 sm:mt-20 flex items-center justify-center gap-2 sm:gap-6 text-[11px] sm:text-xs text-[var(--text-muted)] px-4"
          style={{ opacity: 0, animation: "fade-in-up 0.8s ease-out 0.7s forwards" }}
        >
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-[var(--gold-main)]/60" />
            Winner, Solana Privacy Hack
          </span>
          <span className="text-white/10">|</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-[var(--status-active)]/60" />
            Live on Devnet
          </span>
          <span className="text-white/10 hidden sm:inline">|</span>
          <span className="hidden sm:flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-[var(--status-info)]/60" />
            Open Source
          </span>
        </div>
      </section>

      {/* ===== TABLE VISUAL ===== */}
      <section
        className="relative py-8 sm:py-16 px-4"
        style={{ opacity: 0, animation: "fade-in-up 0.8s ease-out 0.9s forwards" }}
      >
        <div className="max-w-3xl mx-auto">
          <div className="relative w-full aspect-[2.2/1]">
            {/* Table ambient glow */}
            <div
              className="absolute inset-0 rounded-[50%]"
              style={{
                background: "radial-gradient(ellipse at center, rgba(20, 90, 50, 0.25) 0%, transparent 60%)",
                filter: "blur(40px)",
              }}
            />

            {/* Outer rail */}
            <div
              className="absolute inset-2 sm:inset-4 rounded-[50%]"
              style={{
                background: "linear-gradient(135deg, #3d2914 0%, #5c3d1e 20%, #7a4f24 40%, #5c3d1e 60%, #3d2914 80%, #2a1c0e 100%)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.08)",
              }}
            >
              {/* Gold trim */}
              <div
                className="absolute inset-3 rounded-[48%]"
                style={{ border: "1px solid rgba(212, 160, 18, 0.2)" }}
              />
            </div>

            {/* Felt surface */}
            <div
              className="absolute inset-5 sm:inset-10 rounded-[48%] overflow-hidden"
              style={{
                background: "linear-gradient(180deg, #1a7a42 0%, #145a32 40%, #0d4025 100%)",
                boxShadow: "inset 0 4px 30px rgba(0,0,0,0.4)",
              }}
            >
              {/* Spotlight */}
              <div
                className="absolute inset-0"
                style={{
                  background: "radial-gradient(ellipse at center 40%, rgba(255,255,255,0.06) 0%, transparent 60%)",
                }}
              />

              {/* Community cards in center */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex gap-1.5 sm:gap-2">
                  {/* Revealed cards */}
                  {[
                    { rank: "A", suit: "♠", color: "white" },
                    { rank: "K", suit: "♥", color: "#e74c3c" },
                    { rank: "9", suit: "♠", color: "white" },
                  ].map((card, i) => (
                    <div
                      key={i}
                      className="w-8 h-11 sm:w-12 sm:h-[4.2rem] rounded sm:rounded-md flex flex-col items-center justify-center"
                      style={{
                        background: "linear-gradient(145deg, #ffffff 0%, #e8e8e8 100%)",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                      }}
                    >
                      <span
                        className="text-[10px] sm:text-sm font-bold leading-none"
                        style={{ color: card.color === "white" ? "#1a1a1a" : card.color }}
                      >
                        {card.rank}
                      </span>
                      <span
                        className="text-[10px] sm:text-xs leading-none"
                        style={{ color: card.color === "white" ? "#1a1a1a" : card.color }}
                      >
                        {card.suit}
                      </span>
                    </div>
                  ))}
                  {/* Face-down cards (turn + river not yet dealt) */}
                  {[0, 1].map((i) => (
                    <div
                      key={`hidden-${i}`}
                      className="w-8 h-11 sm:w-12 sm:h-[4.2rem] rounded sm:rounded-md flex items-center justify-center"
                      style={{
                        background: "linear-gradient(145deg, #1a3a5c 0%, #0f2844 100%)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                      }}
                    >
                      <div
                        className="w-4 h-5 sm:w-6 sm:h-7 rounded-sm"
                        style={{
                          background: "repeating-linear-gradient(45deg, rgba(255,255,255,0.03), rgba(255,255,255,0.03) 2px, transparent 2px, transparent 6px)",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Player positions — simplified silhouettes */}
            {[
              // bottom center (hero)
              { top: "88%", left: "50%", cards: true, encrypted: false, chips: "1,240" },
              // bottom left
              { top: "70%", left: "8%", cards: true, encrypted: true, chips: "860" },
              // top left
              { top: "22%", left: "12%", cards: true, encrypted: true, chips: "2,100" },
              // top center
              { top: "8%", left: "50%", cards: false, encrypted: false, chips: null },
              // top right
              { top: "22%", left: "88%", cards: true, encrypted: true, chips: "450" },
              // bottom right
              { top: "70%", left: "92%", cards: true, encrypted: true, chips: "1,800" },
            ].map((seat, i) => (
              <div
                key={i}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ top: seat.top, left: seat.left }}
              >
                {seat.chips ? (
                  <div className="flex flex-col items-center gap-0.5">
                    {/* Mini hole cards */}
                    <div className="flex gap-px">
                      {seat.encrypted ? (
                        <>
                          <div className="w-4 h-5 sm:w-5 sm:h-7 rounded-[2px] sm:rounded-sm relative overflow-hidden" style={{
                            background: "linear-gradient(145deg, #1a3a5c 0%, #0f2844 100%)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}>
                            {/* Lock icon */}
                            <div className="absolute inset-0 flex items-center justify-center">
                              <svg className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-[var(--gold-main)]/60" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                          <div className="w-4 h-5 sm:w-5 sm:h-7 rounded-[2px] sm:rounded-sm" style={{
                            background: "linear-gradient(145deg, #1a3a5c 0%, #0f2844 100%)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <svg className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-[var(--gold-main)]/60" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Hero's visible cards */}
                          <div className="w-4 h-5 sm:w-5 sm:h-7 rounded-[2px] sm:rounded-sm flex flex-col items-center justify-center" style={{
                            background: "linear-gradient(145deg, #fff 0%, #e8e8e8 100%)",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                          }}>
                            <span className="text-[6px] sm:text-[8px] font-bold text-gray-900 leading-none">Q</span>
                            <span className="text-[6px] sm:text-[8px] text-red-600 leading-none">♥</span>
                          </div>
                          <div className="w-4 h-5 sm:w-5 sm:h-7 rounded-[2px] sm:rounded-sm flex flex-col items-center justify-center" style={{
                            background: "linear-gradient(145deg, #fff 0%, #e8e8e8 100%)",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                          }}>
                            <span className="text-[6px] sm:text-[8px] font-bold text-gray-900 leading-none">Q</span>
                            <span className="text-[6px] sm:text-[8px] text-gray-900 leading-none">♠</span>
                          </div>
                        </>
                      )}
                    </div>
                    {/* Chip count */}
                    <div
                      className="px-1.5 py-[1px] sm:px-2 sm:py-0.5 rounded-full text-[7px] sm:text-[9px] font-medium whitespace-nowrap"
                      style={{
                        background: "rgba(0,0,0,0.6)",
                        color: i === 0 ? "var(--status-active)" : "var(--text-secondary)",
                        border: i === 0 ? "1px solid rgba(46, 204, 113, 0.3)" : "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      {seat.chips}
                    </div>
                  </div>
                ) : (
                  /* Empty seat */
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-dashed border-white/10 flex items-center justify-center">
                    <span className="text-[8px] text-[var(--text-muted)]">+</span>
                  </div>
                )}
              </div>
            ))}

            {/* Pot indicator in center-top of felt */}
            <div className="absolute top-[32%] sm:top-[28%] left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div
                className="px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[8px] sm:text-[10px] font-medium"
                style={{
                  background: "rgba(0,0,0,0.4)",
                  color: "var(--gold-light)",
                  border: "1px solid rgba(212, 160, 18, 0.2)",
                }}
              >
                Pot: 3,200 USDC
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="py-16 sm:py-24 px-6">
        <div className="max-w-xl mx-auto">
          <h3 className="font-display text-sm tracking-[0.2em] uppercase text-[var(--text-muted)] mb-12 text-center">
            How it works
          </h3>

          <div className="space-y-10">
            {[
              {
                num: "01",
                text: "Your cards are encrypted the moment they\u2019re dealt.",
                sub: "Inco\u2019s fully homomorphic encryption ensures not even the blockchain can read your hand.",
              },
              {
                num: "02",
                text: "Play normally\u200a\u2014\u200abet, raise, fold. Nobody sees your hand.",
                sub: "Game logic executes on encrypted data. Your hole cards stay private throughout the hand.",
              },
              {
                num: "03",
                text: "At showdown, cryptographic proof verifies every card.",
                sub: "Ed25519 signatures confirm each reveal is legitimate. The shuffle was provably random via MagicBlock VRF.",
              },
            ].map((step, i) => (
              <div key={i} className="flex gap-5 items-start group">
                <span className="font-display text-2xl font-bold text-[var(--gold-main)]/30 group-hover:text-[var(--gold-main)]/60 transition-colors shrink-0 w-8 pt-0.5">
                  {step.num}
                </span>
                <div>
                  <p className="text-[var(--text-primary)] text-base sm:text-lg leading-snug mb-1">
                    {step.text}
                  </p>
                  <p className="text-[var(--text-muted)] text-sm leading-relaxed">
                    {step.sub}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== COMPARISON ===== */}
      <section className="py-16 sm:py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <h3 className="font-display text-sm tracking-[0.2em] uppercase text-[var(--text-muted)] mb-12 text-center">
            What makes this different
          </h3>

          <div className="grid sm:grid-cols-2 gap-6 sm:gap-8">
            {/* Traditional */}
            <div className="rounded-xl p-6 sm:p-8" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <p className="text-[var(--text-muted)] text-xs uppercase tracking-widest mb-5">Traditional Online Poker</p>
              <ul className="space-y-3.5">
                {[
                  "Platform sees all cards in real time",
                  "RNG is a closed black box",
                  "Trust the operator completely",
                  "Hand history controlled by the house",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[var(--text-secondary)] text-sm leading-snug">
                    <span className="text-[var(--text-muted)] mt-0.5 shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* HiddenHand */}
            <div className="rounded-xl p-6 sm:p-8" style={{ background: "rgba(20, 90, 50, 0.06)", border: "1px solid rgba(20, 90, 50, 0.15)" }}>
              <p className="text-[var(--gold-main)] text-xs uppercase tracking-widest mb-5">HiddenHand</p>
              <ul className="space-y-3.5">
                {[
                  "Cards encrypted with FHE \u2014 invisible to everyone",
                  "Shuffle verified by VRF \u2014 provably random",
                  "Trust math, not operators",
                  "Every hand auditable on Solana",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[var(--text-primary)] text-sm leading-snug">
                    <span className="text-[var(--status-active)] mt-0.5 shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="py-10 sm:py-14 border-t border-white/5">
        <div className="max-w-3xl mx-auto px-6 flex flex-col items-center gap-4">
          <p className="text-[var(--text-muted)] text-xs text-center">
            Powered by{" "}
            <a
              href="https://magicblock.gg"
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              MagicBlock VRF
            </a>
            {" "}& {" "}
            <a
              href="https://inco.org"
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Inco FHE
            </a>
            {" "}on Solana
          </p>

          <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
            <a
              href="https://github.com/criptocbas/HiddenHand"
              className="hover:text-[var(--text-secondary)] transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <span className="text-white/10">·</span>
            <Link
              href="/responsible-gaming"
              className="hover:text-[var(--text-secondary)] transition-colors"
            >
              Responsible Gaming
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
