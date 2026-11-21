"use client";

import React from "react";
import { StatusChip, StatusVariant } from "./StatusChip";

export interface KpiReadoutProps {
  label: string;
  value: string | number;
  unit?: string;
  badge?: string;
  badgeVariant?: StatusVariant;
  icon?: React.ReactNode;
  className?: string;
}

export function KpiReadout({
  label,
  value,
  unit,
  badge,
  badgeVariant = "neutral",
  icon,
  className = "",
}: KpiReadoutProps) {
  return (
    <div
      className={`bg-ink-900/80 border border-ink-700/60 p-2.5 rounded-md survey-ticks flex flex-col justify-between space-y-1 ${className}`}
    >
      <div className="flex justify-between items-center text-[10px] font-mono">
        <span className="uppercase tracking-survey font-semibold text-bone-500 flex items-center space-x-1.5">
          {icon && <span className="text-saffron-500">{icon}</span>}
          <span>{label}</span>
        </span>
        {badge && (
          <StatusChip variant={badgeVariant} size="sm" label={badge} />
        )}
      </div>

      <div className="flex items-baseline space-x-1.5 pt-0.5">
        <span className="text-lg font-bold font-mono tabular-nums tracking-tight text-bone-50">
          {value}
        </span>
        {unit && (
          <span className="text-[10px] font-mono text-bone-500 font-medium uppercase">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

export default KpiReadout;
