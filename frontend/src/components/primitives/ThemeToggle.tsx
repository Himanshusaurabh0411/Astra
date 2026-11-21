"use client";

import React, { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [isLight, setIsLight] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem("tp_theme");
      if (saved === "light") {
        setIsLight(true);
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.add("light");
        document.documentElement.setAttribute("data-theme", "light");
      } else {
        setIsLight(false);
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
        document.documentElement.setAttribute("data-theme", "dark");
      }
    } catch {}
  }, []);

  const toggleTheme = () => {
    const nextLight = !isLight;
    setIsLight(nextLight);
    try {
      if (nextLight) {
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.add("light");
        document.documentElement.setAttribute("data-theme", "light");
        localStorage.setItem("tp_theme", "light");
      } else {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("tp_theme", "dark");
      }
    } catch {}
  };

  if (!mounted) {
    return <div className="w-6 h-6" />;
  }

  return (
    <button
      onClick={toggleTheme}
      className={`p-1.5 rounded-md border border-ink-700 bg-ink-900/90 text-bone-300 hover:text-bone-50 hover:bg-ink-800 transition focus-visible:ring-2 focus-visible:ring-saffron-500 ${className}`}
      title={isLight ? "Switch to Night Watch (Dark)" : "Switch to Survey Paper (Light)"}
      aria-label="Toggle Cartographic Theme"
    >
      {isLight ? (
        <Moon className="w-3.5 h-3.5 text-bone-300" />
      ) : (
        <Sun className="w-3.5 h-3.5 text-saffron-400" />
      )}
    </button>
  );
}

export default ThemeToggle;
