import type { ReactNode } from "react";
import { ArrowLeft, CloudSun, Landmark, Radio, Settings2, Sprout } from "lucide-react";
import Brand from "@/components/Brand";

const links = [
  { id: "weather", label: "India Weather", icon: CloudSun, href: "/weather" },
  { id: "farm", label: "Farm Planner", icon: Sprout, href: "/farm" },
  { id: "government", label: "Government Portal", icon: Landmark, href: "/government" },
  { id: "field", label: "Field Responder", icon: Radio, href: "/field" },
] as const;

export default function WorkspaceFrame({ active, children }: { active: string; children: ReactNode }) {
  return (
    <div className={`tp-workspace tp-workspace-${active}`}>
      <a className="tp-skip" href="#workspace-content">Skip to main content</a>
      <header className="tp-workspace-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <a href="/" aria-label="TerraPulse dashboard"><Brand /></a>
          <a href="/" className="tp-workspace-back" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#94a3b8", textDecoration: "none", padding: "5px 12px", borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "1px solid #334155" }}>
            <ArrowLeft size={14} /> Back to Dashboard
          </a>
        </div>
        <nav className="tp-workspace-nav" aria-label="TerraPulse workspaces">
          {links.map(({ id, label, icon: Icon, href }) => (
            <a key={id} href={href} aria-current={id === active ? "page" : undefined}>
              <Icon size={16} aria-hidden="true" /> {label}
            </a>
          ))}
          <a href="/#settings">
            <Settings2 size={16} aria-hidden="true" /> Settings
          </a>
        </nav>
      </header>
      <main className="tp-workspace-content" id="workspace-content">{children}</main>
    </div>
  );
}
