import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TerraPulse | Space-to-Ground Geospatial Command",
  description:
    "Space-to-Ground Geospatial Intelligence Pipeline & Offline Tactical Rescue Mesh (MOSDAC, Bhoonidhi, VEDAS, Bhuvan, NavIC, LoRa 865 MHz)",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#070B14",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-ink-950 text-bone-50 min-h-screen antialiased selection:bg-saffron-500/30 selection:text-saffron-400">
        {children}
      </body>
    </html>
  );
}
