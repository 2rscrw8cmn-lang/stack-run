import {
  History,
  House,
  Layers3,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import type { TabId } from "../../app/App";

interface TabDefinition {
  id: TabId;
  label: string;
  Icon: LucideIcon;
}

/**
 * The four places the app can be, in the order the product reads: what matters
 * now, the reward, what actually happened, what is supposed to happen.
 *
 * `History` rather than `Footprints` for Runs: footprints already mean Easy
 * running everywhere activity types are drawn, and a tab is the worst place to
 * spend a symbol twice.
 */
const TABS: TabDefinition[] = [
  { id: "today", label: "Today", Icon: House },
  { id: "build", label: "Build", Icon: Layers3 },
  { id: "runs", label: "Runs", Icon: History },
  { id: "plan", label: "Plan", Icon: ListChecks },
];

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

/**
 * Four equal destinations, and nothing else.
 *
 * Settings used to sit here behind a hairline, which asked the bar to hold
 * both the places the app can be and the way to configure them. It is a gear
 * in the header now, so every control in this bar is a destination and wears
 * `aria-current` when it is the one you are on.
 */
export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <div className="bottom-nav">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className="bottom-nav__item"
          aria-current={activeTab === id ? "page" : undefined}
          onClick={() => onTabChange(id)}
        >
          <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
          <span className="bottom-nav__label">{label}</span>
        </button>
      ))}
    </div>
  );
}
