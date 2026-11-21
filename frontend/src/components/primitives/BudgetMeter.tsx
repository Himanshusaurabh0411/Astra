"use client";

import React from "react";

export interface BudgetMeterProps {
  current: number;
  max: number;
  threshold?: number;
  unit?: string;
  label: string;
  sublabel?: string;
  className?: string;
}

export function BudgetMeter({
  current,
  max,
  threshold,
  unit = "KB",
  label,
  sublabel,
  className = "",
}: BudgetMeterProps) {
  const pct = Math.min(Math.max((current / max) * 100, 0), 100);
  const isOverThreshold = threshold !== undefined && current >= threshold;
  const threshPct = threshold !== undefined ? (threshold / max) * 100 : null;

  return (
    <div className={`space-y-1 font-mono text-[10px] ${className}`}>
      <div className="flex justify-between items-center text-bone-300">
        <span className="uppercase tracking-survey font-semibold text-bone-500">
          {label}
        </span>
        <div className="flex items-center space-x-1 tabular-nums">
          <strong
            className={
              isOverThreshold ? "text-severity-critical" : "text-emerald-400"
            }
          >
            {current.toFixed(1)}
          </strong>
          <span className="text-bone-500">/ {max} {unit}</span>
        </div>
      </div>

      {/* Progress Track */}
      <div className="relative h-1.5 w-full bg-ink-950 rounded-full overflow-hidden border border-ink-700/60">
        <div
          className={`h-full transition-all duration-500 ${
            isOverThreshold ? "bg-severity-critical" : "bg-emerald-400"
          }`}
          style={{ width: `${pct}%` }}
        />
        {threshPct !== null && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-saffron-500 z-10"
            style={{ left: `${threshPct}%` }}
            title={`Threshold: ${threshold} ${unit}`}
          />
        )}
      </div>

      {sublabel && (
        <div className="text-[9px] text-bone-500 tracking-tight">
          {sublabel}
        </div>
      )}
    </div>
  );
}

export default BudgetMeter;
