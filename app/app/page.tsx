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
    <main className="min-h-screen relative">
      {/* Header */}
      <header className="glass-dark sticky top-0 z-50 px-6 py-4 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-4">
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

      {/* Landing Page */}
      <div className="container mx-auto px-4 py-8 pb-32">
        <div className="relative flex flex-col items-center justify-center py-8 overflow-hidden">
          {/* Floating Cards Background */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div
              className="floating-card animate-float-card"
              style={{
                top: '10%',
                left: '8%',
                '--rotate-start': '-15deg',
                '--rotate-end': '-12deg',
                animationDelay: '0s',
              } as React.CSSProperties}
            />
            <div
              className="floating-card hearts animate-float-card"
              style={{
                top: '15%',
                right: '12%',
                '--rotate-start': '20deg',
                '--rotate-end': '25deg',
                animationDelay: '1s',
              } as React.CSSProperties}
            />
            <div
              className="floating-card diamonds animate-float-card"
              style={{
                bottom: '20%',
                left: '5%',
                '--rotate-start': '-8deg',
                '--rotate-end': '-5deg',
                animationDelay: '2s',
              } as React.CSSProperties}
            />
            <div
              className="floating-card clubs animate-float-card"
              style={{
                bottom: '25%',
                right: '8%',
                '--rotate-start': '12deg',
                '--rotate-end': '18deg',
                animationDelay: '0.5s',
              } as React.CSSProperties}
            />
            <div
              className="floating-card animate-float-card"
              style={{
                top: '45%',
                left: '3%',
                '--rotate-start': '25deg',
                '--rotate-end': '30deg',
                animationDelay: '1.5s',
                opacity: 0.4,
              } as React.CSSProperties}
            />
            <div
              className="floating-card hearts animate-float-card"
              style={{
                top: '50%',
                right: '3%',
                '--rotate-start': '-20deg',
                '--rotate-end': '-15deg',
                animationDelay: '2.5s',
                opacity: 0.4,
              } as React.CSSProperties}
            />
          </div>

          {/* Hero */}
          <div className="relative z-10 max-w-3xl mx-auto mb-10 text-center">
            <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <p className="text-[var(--gold-main)] font-medium tracking-[0.3em] uppercase text-sm mb-4">
                Solana Privacy Poker
              </p>
            </div>

            <h2
              className="font-display text-5xl md:text-6xl font-bold text-[var(--text-primary)] mb-5 leading-[1.1] animate-fade-in-up"
              style={{ animationDelay: '0.2s', opacity: 0, animationFillMode: 'forwards' }}
            >
              Don&apos;t Trust
              <br />
              <span className="text-gold-gradient animate-glow-pulse inline-block">
                the Dealer
              </span>
            </h2>

            <p
              className="text-xl md:text-2xl text-[var(--text-secondary)] mb-8 leading-relaxed animate-fade-in-up max-w-xl mx-auto"
              style={{ animationDelay: '0.4s', opacity: 0, animationFillMode: 'forwards' }}
            >
              The only poker game where the house can&apos;t see your cards.
              <span className="block mt-1 text-[var(--text-muted)] text-base">
                Encrypted. On-chain. Provably fair.
              </span>
            </p>

            <div
              className="animate-fade-in-up flex flex-col items-center gap-3"
              style={{ animationDelay: '0.6s', opacity: 0, animationFillMode: 'forwards' }}
            >
              <WalletButton className="btn-gold !text-base !px-10 !py-3 !rounded-xl !font-bold" />
              <a
                href="/lobby"
                className="text-[var(--text-muted)] hover:text-[var(--gold-light)] text-sm transition-colors flex items-center gap-1.5"
              >
                Browse tables without a wallet
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>

          {/* Features */}
          <div
            className="relative z-10 grid md:grid-cols-3 gap-4 max-w-4xl mx-auto w-full animate-fade-in-up"
            style={{ animationDelay: '0.8s', opacity: 0, animationFillMode: 'forwards' }}
          >
            {[
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                ),
                title: "FHE Encryption",
                desc: "Hole cards encrypted with Inco Lightning. Only you can decrypt them.",
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ),
                title: "Verified Fair",
                desc: "MagicBlock VRF ensures provably random shuffles. No rigged decks.",
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                title: "On Solana",
                desc: "Sub-second transactions. Every bet, fold, and showdown on-chain.",
              },
            ].map((feature, idx) => (
              <div
                key={idx}
                className="glass p-5 rounded-2xl hover:border-[var(--gold-main)]/40 transition-all duration-300 group hover:-translate-y-1"
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--felt-main)] to-[var(--felt-dark)] flex items-center justify-center text-[var(--gold-main)] mb-3 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  {feature.icon}
                </div>
                <h3 className="font-display text-sm font-bold text-[var(--text-primary)] mb-1.5 tracking-wide">
                  {feature.title}
                </h3>
                <p className="text-[var(--text-secondary)] text-xs leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Subtle gradient overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[var(--bg-deep)] to-transparent pointer-events-none" />
        </div>
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 w-full glass-dark py-4 text-center border-t border-white/5">
        <p className="text-[var(--text-muted)] text-sm">
          Built for{" "}
          <a
            href="https://solana.com/privacyhack"
            className="text-[var(--felt-highlight)] hover:text-[var(--felt-light)] transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Solana Privacy Hack
          </a>
          {" "}with{" "}
          <a
            href="https://magicblock.gg"
            className="text-purple-400 hover:text-purple-300 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            MagicBlock VRF
          </a>
          {" "}&{" "}
          <a
            href="https://inco.org"
            className="text-cyan-400 hover:text-cyan-300 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Inco FHE
          </a>
          <span className="mx-2 text-white/10">|</span>
          <Link href="/responsible-gaming" className="text-amber-400/60 hover:text-amber-400 transition-colors">
            Responsible Gaming
          </Link>
        </p>
      </footer>
    </main>
  );
}
