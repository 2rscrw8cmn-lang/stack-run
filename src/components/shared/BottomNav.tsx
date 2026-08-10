import {
  House,
  Layers3,
  ListChecks,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";
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
  onOpenSettings: () => void;
  isSettingsOpen: boolean;
}

/**
 * The three destinations, and the way into everything that configures them.
 *
 * Settings sits in the bar because that is where a hand already is, but it is
 * deliberately not a tab: it opens a sheet, it is never `aria-current`, and a
 * hairline separates it from the three places the app can actually be.
 */
export function BottomNav({
  activeTab,
  onTabChange,
  onOpenSettings,
  isSettingsOpen,
}: BottomNavProps) {
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
      <button
        type="button"
        className="bottom-nav__item bottom-nav__item--settings"
        aria-haspopup="dialog"
        aria-expanded={isSettingsOpen}
        onClick={onOpenSettings}
      >
        <SettingsIcon size={20} strokeWidth={1.8} aria-hidden="true" />
        <span className="bottom-nav__label">Settings</span>
      </button>
    </div>
  );
}
