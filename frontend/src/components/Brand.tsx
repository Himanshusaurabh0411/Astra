import { RadioTower } from "lucide-react";

export default function Brand() {
  return <span className="tp-brand">
    <span className="tp-brand-icon"><RadioTower size={22} strokeWidth={1.7} aria-hidden /></span>
    <span><strong>TerraPulse</strong><small>Monitor · Analyse · Act</small></span>
  </span>;
}
