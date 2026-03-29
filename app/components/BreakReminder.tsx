"use client";

import { FC, useEffect, useState } from "react";

interface BreakReminderProps {
  sessionTime: string;
  onDismiss: () => void;
}

export const BreakReminder: FC<BreakReminderProps> = ({
  sessionTime,
  onDismiss,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 300);
  };

  return (
    <div
      className={`fixed top-20 right-4 z-[60] max-w-sm transition-all duration-300 ${
        visible
          ? "opacity-100 translate-x-0"
          : "opacity-0 translate-x-8"
      }`}
    >
      <div className="rounded-xl border border-amber-500/30 bg-amber-900/20 backdrop-blur-md p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
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
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-amber-200 text-sm font-medium">
              You&apos;ve been playing for {sessionTime}
            </p>
            <p className="text-amber-200/60 text-xs mt-1">
              Consider taking a break. Staying refreshed helps you play your best.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-amber-400/60 hover:text-amber-300 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
