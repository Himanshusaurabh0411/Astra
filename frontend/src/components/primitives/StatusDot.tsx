"use client";

import React from "react";
import { StatusVariant } from "./StatusChip";

export interface StatusDotProps {
  status?: StatusVariant;
  pulse?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function StatusDot({
  status = "normal",
  pulse = false,
  size = "md",
  className = "",
}: StatusDotProps) {
  const sizeClasses = size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2";

  const colorMap: Record<StatusVariant, string> = {
    normal: "bg-emerald-400",
    watch: "bg-amber-400",
    warning: "bg-orange-400",
    critical: "bg-rose-500",
    mesh: "bg-emerald-400",
    offline: "bg-rose-500",
    neutral: "bg-bone-500",
    saffron: "bg-saffron-500",
  };

  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      {pulse && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${colorMap[status]}`}
        />
      )}
      <span className={`relative inline-flex rounded-full ${sizeClasses} ${colorMap[status]}`} />
    </span>
  );
}

export default StatusDot;
