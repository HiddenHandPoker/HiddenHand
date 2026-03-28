"use client";

import { FC, ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: ReactNode;
  color?: "gold" | "green" | "red" | "default";
  tooltip?: string;
}

export const StatCard: FC<StatCardProps> = ({
  label,
  value,
  subValue,
  icon,
  color = "default",
  tooltip,
}) => {
  const valueColor = {
    gold: "text-gold-gradient",
    green: "text-[var(--status-active)]",
    red: "text-[var(--status-danger)]",
    default: "text-[var(--text-primary)]",
  }[color];

  return (
    <div
      className="glass-dark rounded-xl p-4 hover:border-[var(--gold-main)]/30 transition-all duration-200 group"
      title={tooltip}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {icon && (
          <span className="text-[var(--text-muted)] group-hover:text-[var(--gold-main)] transition-colors">
            {icon}
          </span>
        )}
        <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">
          {label}
        </span>
      </div>
      <div className={`font-display text-2xl font-bold ${valueColor}`}>
        {value}
      </div>
      {subValue && (
        <div className="text-xs text-[var(--text-muted)] mt-0.5">{subValue}</div>
      )}
    </div>
  );
};
