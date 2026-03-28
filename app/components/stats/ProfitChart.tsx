"use client";

import { FC, useMemo } from "react";
import { type TokenInfo, getDefaultToken, baseUnitsToDisplay } from "@/lib/tokens";

interface ProfitChartProps {
  data: { handNumber: number; cumulative: number }[];
  token?: TokenInfo;
  height?: number;
}

export const ProfitChart: FC<ProfitChartProps> = ({
  data,
  token = getDefaultToken(),
  height = 200,
}) => {
  const chartData = useMemo(() => {
    if (data.length === 0) return null;

    const values = data.map(d => baseUnitsToDisplay(d.cumulative, token));
    const minVal = Math.min(0, ...values);
    const maxVal = Math.max(0, ...values);
    const range = maxVal - minVal || 1;

    const padding = 40; // left padding for labels
    const topPad = 16;
    const bottomPad = 24;
    const rightPad = 8;
    const chartWidth = 600;
    const chartHeight = height - topPad - bottomPad;

    const xStep = data.length > 1 ? (chartWidth - padding - rightPad) / (data.length - 1) : 0;

    const points = values.map((v, i) => ({
      x: padding + i * xStep,
      y: topPad + chartHeight - ((v - minVal) / range) * chartHeight,
    }));

    const polyline = points.map(p => `${p.x},${p.y}`).join(" ");

    // Zero line
    const zeroY = topPad + chartHeight - ((0 - minVal) / range) * chartHeight;

    // Gradient area (fill below line, above zero for profit, below zero for loss)
    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    const fillPath = `M${firstPoint.x},${zeroY} L${polyline} L${lastPoint.x},${zeroY} Z`;

    // Current value for color
    const currentValue = values[values.length - 1];
    const isPositive = currentValue >= 0;

    // Y-axis labels
    const yLabels = [];
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const val = minVal + (range / steps) * i;
      const y = topPad + chartHeight - (i / steps) * chartHeight;
      yLabels.push({ value: val, y });
    }

    return {
      polyline,
      fillPath,
      zeroY,
      isPositive,
      currentValue,
      yLabels,
      points,
      chartWidth,
      chartHeight: height,
      padding,
    };
  }, [data, token, height]);

  if (!chartData || data.length < 2) {
    return (
      <div className="glass-dark rounded-xl p-6 flex items-center justify-center" style={{ height }}>
        <p className="text-sm text-[var(--text-muted)]">
          {data.length === 0 ? "No hand data yet" : "Need at least 2 hands for chart"}
        </p>
      </div>
    );
  }

  const strokeColor = chartData.isPositive ? "var(--status-active)" : "var(--status-danger)";
  const fillId = chartData.isPositive ? "profitFill" : "lossFill";

  return (
    <div className="glass-dark rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Cumulative Profit/Loss
        </h3>
        <span className={`text-sm font-bold ${chartData.isPositive ? "text-[var(--status-active)]" : "text-[var(--status-danger)]"}`}>
          {chartData.isPositive ? "+" : ""}{chartData.currentValue.toFixed(2)} {token.symbol}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${chartData.chartWidth} ${chartData.chartHeight}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--status-active)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--status-active)" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="lossFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--status-danger)" stopOpacity="0.02" />
            <stop offset="100%" stopColor="var(--status-danger)" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {chartData.yLabels.map((label, i) => (
          <g key={i}>
            <line
              x1={chartData.padding}
              y1={label.y}
              x2={chartData.chartWidth}
              y2={label.y}
              stroke="rgba(255,255,255,0.05)"
              strokeDasharray="4,4"
            />
            <text
              x={chartData.padding - 4}
              y={label.y + 3}
              textAnchor="end"
              fill="var(--text-muted)"
              fontSize="10"
              fontFamily="Outfit, sans-serif"
            >
              {label.value >= 0 ? "+" : ""}{label.value.toFixed(1)}
            </text>
          </g>
        ))}

        {/* Zero line */}
        <line
          x1={chartData.padding}
          y1={chartData.zeroY}
          x2={chartData.chartWidth}
          y2={chartData.zeroY}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
        />

        {/* Gradient fill */}
        <path d={chartData.fillPath} fill={`url(#${fillId})`} />

        {/* Line */}
        <polyline
          points={chartData.polyline}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* End dot */}
        {chartData.points.length > 0 && (
          <circle
            cx={chartData.points[chartData.points.length - 1].x}
            cy={chartData.points[chartData.points.length - 1].y}
            r="4"
            fill={strokeColor}
            stroke="var(--bg-deep)"
            strokeWidth="2"
          />
        )}

        {/* X-axis labels */}
        <text
          x={chartData.padding}
          y={chartData.chartHeight - 4}
          fill="var(--text-muted)"
          fontSize="10"
          fontFamily="Outfit, sans-serif"
        >
          Hand #{data[0].handNumber}
        </text>
        <text
          x={chartData.chartWidth - chartData.padding}
          y={chartData.chartHeight - 4}
          textAnchor="end"
          fill="var(--text-muted)"
          fontSize="10"
          fontFamily="Outfit, sans-serif"
        >
          Hand #{data[data.length - 1].handNumber}
        </text>
      </svg>
    </div>
  );
};
