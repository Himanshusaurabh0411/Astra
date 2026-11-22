import type { Metadata } from "next";
import OfflineShell from "@/components/OfflineShell";
import "./globals.css";
import "./operations.css";
import "./workspaces.css";

export const metadata: Metadata = {
  title: "TerraPulse | India Disaster Monitor",
  description: "Follow heavy rain, flooding, safer routes and help requests across India.",
  manifest: "/manifest.json",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};

export const viewport = { themeColor: "#070B14" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <OfflineShell />
        {children}
      </body>
    </html>
  );
}
