"use client";

import { FC, useRef, useEffect } from "react";
import {
  ACTION_NAMES,
  formatLiveActionLine,
  type ActionTakenTimelineEvent,
} from "@/hooks/useHandHistory";

interface GameHistoryProps {
  /** Current-hand ActionTaken events for every seat — not a hero-only local log. */
  liveActions: ActionTakenTimelineEvent[];
  formatAmount: (baseUnits: number) => string;
  maxHeight?: string;
}

function actionTextClass(actionType: number): string {
  switch (actionType) {
    case 0:
    case 5:
      return "text-[var(--status-danger)]";
    case 3:
      return "text-[var(--gold-light)]";
    case 4:
      return "text-purple-400 font-semibold";
    case 6:
      return "text-[var(--text-muted)] italic";
    default:
      return "text-[var(--text-secondary)]";
  }
}

/** Current-hand ActionTaken list for every seat. */
export const GameHistory: FC<GameHistoryProps> = ({
  liveActions,
  formatAmount,
  maxHeight = "300px",
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [liveActions.length]);

  if (liveActions.length === 0) {
    return null;
  }

  return (
    <div className="glass rounded-xl p-4">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
        This Hand
      </h3>
      <div
        ref={scrollRef}
        className="space-y-1.5 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
        style={{ maxHeight }}
      >
        {liveActions.map((action, i) => {
          const key = `${action.signature ?? action.timestamp.getTime()}-${action.seatIndex}-${action.actionType}-${i}`;
          const name = ACTION_NAMES[action.actionType] ?? "Act";
          return (
            <div key={key} className="flex items-start gap-2 text-sm">
              <div className="flex-shrink-0 mt-1.5">
                <div className="w-2 h-2 rounded-full bg-[var(--gold-main)]" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[var(--text-muted)] text-xs mr-2">
                  {action.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
                <span className={actionTextClass(action.actionType)} title={name}>
                  {formatLiveActionLine(action, formatAmount)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
