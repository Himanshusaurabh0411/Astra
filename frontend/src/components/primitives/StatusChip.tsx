"use client";

import React from "react";

export type StatusVariant =
  | "normal"
  | "watch"
  | "warning"
  | "critical"
  | "mesh"
  | "offline"
  | "neutral"
  | "saffron";

export interface StatusChipProps {
  variant?: StatusVariant;
  size?: "sm" | "md";
  label?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function StatusChip({
  variant = "neutral",
  size = "md",
  label,
  icon,
  children,
  className = "",
  onClick,
}: StatusChipProps) {
  const sizeClasses =
    size === "sm"
      ? "text-[9px] px-1.5 py-0.5 tracking-[0.08em]"
      : "text-[10px] px-2 py-0.5 tracking-survey";

  const variantMap: Record<StatusVariant, string> = {
    normal:
      "bg-emerald-950/70 text-emerald-300 border border-emerald-700/60",
    watch:
      "bg-amber-950/70 text-amber-300 border border-amber-700/60",
    warning:
      "bg-orange-950/70 text-orange-300 border border-orange-700/60",
    critical:
      "bg-rose-950/80 text-rose-300 border border-rose-600 font-bold animate-pulse",
    mesh:
      "bg-emerald-950/80 text-emerald-300 border border-emerald-500/80 font-bold",
    offline:
      "bg-rose-950/90 text-rose-200 border border-rose-700 font-bold",
    neutral:
      "bg-ink-800/90 text-bone-300 border border-ink-700",
    saffron:
      "bg-saffron-500/15 text-saffron-400 border border-saffron-500/50 font-bold",
  };

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center space-x-1 font-mono uppercase font-semibold rounded ${sizeClasses} ${variantMap[variant]} ${
        onClick ? "cursor-pointer hover:brightness-110 transition" : ""
      } ${className}`}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{label || children}</span>
    </span>
  );
}

export default StatusChip;
