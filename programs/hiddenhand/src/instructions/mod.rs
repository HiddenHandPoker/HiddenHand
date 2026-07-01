pub mod create_table;
pub mod join_table;
pub mod leave_table;
pub mod player_action;
pub mod showdown;
pub mod start_hand;

// Timeout handling
pub mod timeout_player;

// Table management / liveness
pub mod close_inactive_table;

// Rake collection
pub mod collect_rake;

// ============================================================
// Arcium MPC card lifecycle (Phase 3b — replaces VRF + Inco)
// ============================================================
pub mod shuffle;
pub mod deal_to_seat;
pub mod reveal_common;
pub mod reveal_flop;
pub mod reveal_turn;
pub mod reveal_river;
pub mod showdown_reveal;

// Re-export everything for convenience
// The `handler` name conflicts are expected and handled by Anchor's program macro
#[allow(ambiguous_glob_reexports)]
pub use create_table::*;
#[allow(ambiguous_glob_reexports)]
pub use join_table::*;
#[allow(ambiguous_glob_reexports)]
pub use leave_table::*;
#[allow(ambiguous_glob_reexports)]
pub use player_action::*;
#[allow(ambiguous_glob_reexports)]
pub use showdown::*;
#[allow(ambiguous_glob_reexports)]
pub use start_hand::*;
#[allow(ambiguous_glob_reexports)]
pub use timeout_player::*;
#[allow(ambiguous_glob_reexports)]
pub use close_inactive_table::*;
#[allow(ambiguous_glob_reexports)]
pub use collect_rake::*;

#[allow(ambiguous_glob_reexports)]
pub use shuffle::*;
#[allow(ambiguous_glob_reexports)]
pub use deal_to_seat::*;
#[allow(ambiguous_glob_reexports)]
pub use reveal_flop::*;
#[allow(ambiguous_glob_reexports)]
pub use reveal_turn::*;
#[allow(ambiguous_glob_reexports)]
pub use reveal_river::*;
#[allow(ambiguous_glob_reexports)]
pub use showdown_reveal::*;
