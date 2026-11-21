"use client";

import React from "react";

export interface SurveyCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "inset" | "interactive" | "critical";
  topo?: boolean;
  ticks?: boolean;
  children: React.ReactNode;
}

export function SurveyCard({
  variant = "default",
  topo = false,
  ticks = true,
  className = "",
  children,
  ...props
}: SurveyCardProps) {
  const baseClasses =
    variant === "inset"
      ? "bg-ink-900/90 border border-ink-700/80"
      : variant === "interactive"
      ? "survey-interactive rounded-md"
      : variant === "critical"
      ? "bg-rose-950/25 border border-severity-critical/40"
      : "bg-ink-900 border border-ink-700/60 rounded-md shadow-survey";

  const topoClass = topo ? "bg-topo-contours" : "";
  const ticksClass = ticks ? "survey-ticks" : "";

  return (
    <div
      className={`${baseClasses} ${topoClass} ${ticksClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export default SurveyCard;
