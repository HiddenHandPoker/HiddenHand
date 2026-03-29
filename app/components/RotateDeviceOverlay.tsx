"use client";

import { FC, useState } from "react";
import { useIsMobilePortrait } from "@/hooks/useIsMobile";

/**
 * Overlay shown on mobile portrait orientation on the table page.
 * Suggests rotating to landscape for the best poker experience.
 * Dismissible — never blocks the user.
 */
export const RotateDeviceOverlay: FC = () => {
  const isMobilePortrait = useIsMobilePortrait();
  const [dismissed, setDismissed] = useState(false);

  if (!isMobilePortrait || dismissed) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 safe-bottom safe-top">
      {/* Animated phone rotation icon */}
      <div className="mb-6 relative">
        <svg
          className="w-20 h-20 text-[var(--gold-light)]"
          viewBox="0 0 100 100"
          fill="none"
          style={{ animation: "rotate-phone 2s ease-in-out infinite" }}
        >
          {/* Phone outline */}
          <rect
            x="30" y="15" width="40" height="70" rx="6"
            stroke="currentColor" strokeWidth="3" fill="none"
          />
          {/* Screen */}
          <rect
            x="34" y="22" width="32" height="52" rx="2"
            fill="currentColor" opacity="0.15"
          />
          {/* Home button */}
          <circle cx="50" cy="80" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
        {/* Rotation arrow */}
        <svg
          className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 text-[var(--gold-main)]"
          viewBox="0 0 24 24"
          fill="currentColor"
          style={{ animation: "rotate-arrow 2s ease-in-out infinite" }}
        >
          <path d="M15.55 5.55L11 1v3.07C7.06 4.56 4 7.92 4 12s3.05 7.44 7 7.93v-2.02c-2.84-.48-5-2.94-5-5.91s2.16-5.43 5-5.91V10l4.55-4.45zM19.93 11c-.17-1.39-.72-2.73-1.62-3.89l-1.42 1.42c.54.75.88 1.6 1.02 2.47h2.02zM13 17.9v2.02c1.39-.17 2.74-.71 3.9-1.61l-1.44-1.44c-.75.54-1.59.89-2.46 1.03zm3.89-2.42l1.42 1.41c.9-1.16 1.45-2.5 1.62-3.89h-2.02c-.14.87-.48 1.72-1.02 2.48z" />
        </svg>
      </div>

      <h2 className="font-display text-xl font-bold text-[var(--gold-light)] mb-2 text-center">
        Rotate for Best Experience
      </h2>
      <p className="text-[var(--text-secondary)] text-sm text-center mb-6 max-w-xs">
        Turn your phone sideways to play poker in landscape mode, just like the pros.
      </p>

      <button
        onClick={() => setDismissed(true)}
        className="btn-action px-6 py-3 rounded-xl text-sm font-semibold border border-white/20 transition-all touch-target"
      >
        Continue in Portrait
      </button>
    </div>
  );
};
