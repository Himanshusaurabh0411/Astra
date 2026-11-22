import type { ReactNode } from "react";
import { CloudSun, Landmark, Sprout } from "lucide-react";
import Brand from "@/components/Brand";

const links = [
  { id: "weather", label: "India Weather", icon: CloudSun },
  { id: "farm", label: "Farm Planner", icon: Sprout },
  { id: "government", label: "Government Portal", icon: Landmark },
] as const;

export default function WorkspaceFrame({ active, children }: { active: typeof links[number]["id"]; children: ReactNode }) {
  return <div className={`tp-workspace tp-workspace-${active}`}>
    <a className="tp-skip" href="#workspace-content">Skip to main content</a>
    <header className="tp-workspace-bar">
      <a href="/" aria-label="TerraPulse dashboard"><Brand /></a>
      <nav className="tp-workspace-nav" aria-label="TerraPulse workspaces">
        {links.map(({ id, label, icon: Icon }) => <a key={id} href={`/${id}`} aria-current={id === active ? "page" : undefined}>
          <Icon size={17} aria-hidden="true" /> {label}
        </a>)}
      </nav>
    </header>
    <main className="tp-workspace-content" id="workspace-content">{children}</main>
  </div>;
}
