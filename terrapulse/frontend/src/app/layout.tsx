import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TerraPulse | Space-to-Ground Geospatial Command",
  description: "Space-to-Ground Geospatial Intelligence Pipeline & Offline Tactical Rescue Mesh (MOSDAC, Bhoonidhi, VEDAS, Bhuvan, NavIC, LoRa 865 MHz)",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#0ea5e9",
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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#060b18] text-slate-100 min-h-screen antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
        {children}
      </body>
    </html>
  );
}
