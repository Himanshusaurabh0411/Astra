"use client";

import React from "react";

export interface SectionLabelProps {
  title: string;
  portal?: string;
  portalColor?: string;
  rightAction?: React.ReactNode;
  className?: string;
}

export function SectionLabel({
  title,
  portal,
  portalColor = "text-saffron-400",
  rightAction,
  className = "",
}: SectionLabelProps) {
  return (
    <div
      className={`flex items-center justify-between border-b border-ink-700/80 pb-1.5 font-mono text-[10px] ${className}`}
    >
      <div className="flex items-center space-x-2">
        <span className="uppercase tracking-survey font-bold text-bone-50">
          {title}
        </span>
        {portal && (
          <span
            className={`px-1.5 py-0.2 rounded text-[9px] font-semibold bg-ink-950 border border-ink-700 ${portalColor}`}
          >
            {portal}
          </span>
        )}
      </div>
      {rightAction && <div>{rightAction}</div>}
    </div>
  );
}

export default SectionLabel;
