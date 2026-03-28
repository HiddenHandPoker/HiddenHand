"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { WalletButton } from "@/components/WalletButton";
import { SoundToggle } from "@/components/SoundToggle";
import { NETWORK } from "@/contexts/WalletProvider";
import { useLobby, type StakeTier, type TableSize, type LobbyTable } from "@/hooks/useLobby";
import { usePokerProgram } from "@/hooks/usePokerProgram";
import { TableList, type ViewMode } from "@/components/lobby/TableList";
import { CreateTableModal } from "@/components/lobby/CreateTableModal";
import { QuickPlayModal } from "@/components/lobby/QuickPlayModal";
import { generateTableId, getTablePDA, getVaultPDA } from "@/lib/program";
import { SystemProgram } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { getDefaultToken, TOKEN_PROGRAM_ID } from "@/lib/tokens";
import { getRakeForBlinds } from "@/lib/rake";

export default function LobbyPage() {
  const { connected, publicKey } = useWallet();
  const { program, provider } = usePokerProgram();
  const router = useRouter();

  const {
    tables,
    filteredTables,
    loading,
    error,
    filter,
    setFilter,
    sort,
    setSort,
    stakeTier,
    setStakeTier,
    tableSize,
    setTableSize,
    refresh,
    tableCount,
  } = useLobby();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQuickPlay, setShowQuickPlay] = useState(false);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Total players across all visible tables
  const totalPlayers = filteredTables.reduce(
    (sum, t) => sum + t.currentPlayers,
    0
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const handleCreateTable = useCallback(
    async (config: {
      tableId: string;
      smallBlind: number;
      bigBlind: number;
      minBuyIn: number;
      maxBuyIn: number;
      maxPlayers: number;
      rakeBps: number;
      rakeCap: number;
    }) => {
      if (!program || !provider || !publicKey) return;

      setCreating(true);
      try {
        const token = getDefaultToken();
        const tableIdBytes = generateTableId(config.tableId);
        const [tablePDA] = getTablePDA(tableIdBytes);
        const [vaultPDA] = getVaultPDA(tablePDA);

        await program.methods
          .createTable(
            Array.from(tableIdBytes),
            new BN(config.smallBlind),
            new BN(config.bigBlind),
            new BN(config.minBuyIn),
            new BN(config.maxBuyIn),
            config.maxPlayers,
            config.rakeBps,
            new BN(config.rakeCap)
          )
          .accounts({
            authority: publicKey,
            table: tablePDA,
            mint: token.mint,
            vault: vaultPDA,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        setShowCreateModal(false);
        router.push(`/table/${encodeURIComponent(config.tableId)}`);
      } catch (err) {
        console.error("Create table failed:", err);
        throw err;
      } finally {
        setCreating(false);
      }
    },
    [program, provider, publicKey, router]
  );

  // Quick Play: join existing table
  const handleQuickJoin = useCallback(
    (table: LobbyTable, buyIn: number) => {
      router.push(`/table/${encodeURIComponent(table.tableId)}`);
    },
    [router]
  );

  // Quick Play: create new table and navigate
  const handleQuickCreate = useCallback(
    async (config: {
      smallBlind: number;
      bigBlind: number;
      minBuyIn: number;
      maxBuyIn: number;
      maxPlayers: number;
      buyIn: number;
    }) => {
      if (!program || !provider || !publicKey) return;

      const tableName = `Quick-${Date.now().toString(36)}`;
      const rake = getRakeForBlinds(config.bigBlind);
      try {
        await handleCreateTable({
          tableId: tableName,
          ...config,
          rakeBps: rake.rakeBps,
          rakeCap: rake.rakeCap,
        });
      } catch (err) {
        console.error("Quick create failed:", err);
      }
    },
    [program, provider, publicKey, handleCreateTable]
  );

  // Sort options
  const sortOptions: { value: typeof sort; label: string }[] = [
    { value: "active", label: "Most Active" },
    { value: "players", label: "Most Players" },
    { value: "stakes", label: "Highest Stakes" },
    { value: "newest", label: "Newest" },
  ];

  // Filter tabs
  const filterTabs: { value: typeof filter; label: string; count: number }[] = [
    { value: "all", label: "All", count: tableCount.all },
    { value: "waiting", label: "Waiting", count: tableCount.waiting },
    { value: "playing", label: "Playing", count: tableCount.playing },
  ];

  // Stake tier pills
  const stakeTiers: { value: StakeTier; label: string }[] = [
    { value: "all", label: "All Stakes" },
    { value: "micro", label: "Micro" },
    { value: "low", label: "Low" },
    { value: "mid", label: "Mid" },
    { value: "high", label: "High" },
  ];

  // Table size pills
  const tableSizes: { value: TableSize; label: string }[] = [
    { value: "all", label: "All Sizes" },
    { value: "headsup", label: "Heads-Up" },
    { value: "6max", label: "6-Max" },
  ];

  return (
    <main className="min-h-screen relative">
      {/* Header */}
      <header className="glass-dark sticky top-0 z-50 px-6 py-4 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
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
              ${
                NETWORK === "localnet"
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

      {/* Main content */}
      <div className="container mx-auto px-4 py-8 pb-32">
        {/* Title area */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-[var(--text-primary)]">
              Table Lobby
            </h2>
            {!connected && (
              <p className="text-[var(--text-muted)] text-sm mt-1">
                Connect a wallet to create or join tables
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-10 h-10 rounded-xl bg-[var(--bg-dark)] border border-white/5 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-white/10 transition-all disabled:opacity-50"
              title="Refresh tables"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183"
                />
              </svg>
            </button>

            {connected && (
              <>
                {/* Quick Play button */}
                <button
                  onClick={() => setShowQuickPlay(true)}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Quick Play
                </button>

                {/* Create table button */}
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-gold px-6 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4.5v15m7.5-7.5h-15"
                    />
                  </svg>
                  Create Table
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-6 mb-6 text-sm">
          <span className="text-[var(--text-secondary)]">
            <span className="text-[var(--text-primary)] font-semibold">
              {tableCount.all}
            </span>{" "}
            {tableCount.all === 1 ? "table" : "tables"} active
          </span>
          <span className="text-white/10">|</span>
          <span className="text-[var(--text-secondary)]">
            <span className="text-[var(--text-primary)] font-semibold">
              {totalPlayers}
            </span>{" "}
            {totalPlayers === 1 ? "player" : "players"} seated
          </span>
        </div>

        {/* Filter row 1: Status + Sort + View toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          {/* Filter pills */}
          <div className="flex items-center gap-2">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={`
                  px-4 py-2 rounded-full text-sm font-medium transition-all
                  ${
                    filter === tab.value
                      ? "bg-[var(--gold-main)]/20 text-[var(--gold-light)] border border-[var(--gold-main)]/40"
                      : "bg-[var(--bg-dark)] text-[var(--text-muted)] border border-white/5 hover:text-[var(--text-secondary)] hover:border-white/10"
                  }
                `}
              >
                {tab.label}{" "}
                <span
                  className={
                    filter === tab.value
                      ? "text-[var(--gold-main)]"
                      : "text-[var(--text-muted)]"
                  }
                >
                  ({tab.count})
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {/* Sort dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)] text-sm">Sort by</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="bg-[var(--bg-dark)] text-[var(--text-primary)] text-sm px-3 py-2 rounded-xl border border-white/5 focus:border-[var(--gold-main)] transition-colors appearance-none cursor-pointer pr-8"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23888'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 0.5rem center",
                  backgroundSize: "1rem",
                }}
              >
                {sortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-1 bg-[var(--bg-dark)] rounded-lg p-0.5 border border-white/5">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-md transition-all ${
                  viewMode === "grid"
                    ? "bg-[var(--gold-main)]/20 text-[var(--gold-light)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
                title="Grid view"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-md transition-all ${
                  viewMode === "list"
                    ? "bg-[var(--gold-main)]/20 text-[var(--gold-light)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
                title="List view"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Filter row 2: Stake tier + Table size */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {/* Stake tier pills */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mr-1">
              Stakes
            </span>
            {stakeTiers.map((tier) => (
              <button
                key={tier.value}
                onClick={() => setStakeTier(tier.value)}
                className={`
                  px-3 py-1.5 rounded-full text-xs font-medium transition-all
                  ${
                    stakeTier === tier.value
                      ? "bg-[var(--felt-main)]/20 text-[var(--felt-highlight)] border border-[var(--felt-main)]/40"
                      : "bg-[var(--bg-dark)] text-[var(--text-muted)] border border-white/5 hover:text-[var(--text-secondary)] hover:border-white/10"
                  }
                `}
              >
                {tier.label}
              </button>
            ))}
          </div>

          {/* Table size pills */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mr-1">
              Size
            </span>
            {tableSizes.map((size) => (
              <button
                key={size.value}
                onClick={() => setTableSize(size.value)}
                className={`
                  px-3 py-1.5 rounded-full text-xs font-medium transition-all
                  ${
                    tableSize === size.value
                      ? "bg-[var(--felt-main)]/20 text-[var(--felt-highlight)] border border-[var(--felt-main)]/40"
                      : "bg-[var(--bg-dark)] text-[var(--text-muted)] border border-white/5 hover:text-[var(--text-secondary)] hover:border-white/10"
                  }
                `}
              >
                {size.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="glass rounded-xl p-4 mb-6 border border-red-500/20 bg-red-500/5">
            <p className="text-red-400 text-sm">
              Failed to load tables: {error}
            </p>
          </div>
        )}

        {/* Table list */}
        <TableList
          tables={filteredTables}
          loading={loading}
          currentWallet={publicKey?.toString()}
          viewMode={viewMode}
        />
      </div>

      {/* Create Table Modal */}
      <CreateTableModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateTable={handleCreateTable}
        loading={creating}
      />

      {/* Quick Play Modal */}
      <QuickPlayModal
        isOpen={showQuickPlay}
        onClose={() => setShowQuickPlay(false)}
        tables={tables}
        onJoinTable={handleQuickJoin}
        onCreateAndJoin={handleQuickCreate}
        loading={creating}
      />

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
        </p>
      </footer>
    </main>
  );
}
