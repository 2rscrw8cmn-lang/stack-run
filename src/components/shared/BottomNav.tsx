import { House, Layers3, ListChecks, type LucideIcon } from "lucide-react";
import type { TabId } from "../../app/App";

interface TabDefinition {
  id: TabId;
  label: string;
  Icon: LucideIcon;
}

const TABS: TabDefinition[] = [
  { id: "today", label: "Today", Icon: House },
  { id: "build", label: "Build", Icon: Layers3 },
  { id: "plan", label: "Plan", Icon: ListChecks },
];

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

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
