import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Dark "Night Watch" Neutral Palette
        ink: {
          950: "#070B14",
          900: "#0B1220",
          800: "#111A2C",
          700: "#1B2740",
          600: "#2A3A5C",
        },
        // Text Palette
        bone: {
          50: "#EEF2F7",
          300: "#A9B4C6",
          500: "#6E7B93",
        },
        // Brand Accent (Saffron-Ember)
        saffron: {
          400: "#FFA15E",
          500: "#FF8A3D",
          600: "#E67226",
          700: "#B85412",
        },
        // Domain Specific Geospatial Hues
        mosdac: "#5BC0FF",
        bhoonidhi: {
          teal: "#2DD4C4",
          blue: "#1E6FD9",
        },
        vedas: {
          open: "#9BE564",
          submerged: "#FF5D5D",
          corridor: "#F5D547",
        },
        bhuvan: "#B79CFF",
        mesh: "#4ADE80",
        // Standardized Severity Tiers
        severity: {
          normal: "#4ADE80",
          watch: "#F5D547",
          warning: "#FF8A3D",
          critical: "#FF4D4D",
        },
        // Light "Survey Paper" Palette
        paper: {
          page: "#F4EFE4",
          surface: "#FBF8F1",
          inset: "#EDE6D6",
          border: "#DDD3BD",
          text: "#14213D",
          muted: "#475569",
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "'IBM Plex Mono'", "ui-monospace", "monospace"],
        sans: ["'Plus Jakarta Sans'", "Inter", "-apple-system", "sans-serif"],
        serif: ["'Instrument Serif'", "Georgia", "serif"],
      },
      letterSpacing: {
        survey: "0.12em",
      },
      boxShadow: {
        survey: "0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px -1px rgba(0, 0, 0, 0.4)",
        "survey-lg": "0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
      },
    },
  },
  plugins: [],
};

export default config;
