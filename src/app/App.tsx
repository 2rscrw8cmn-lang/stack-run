import { useState } from "react";
import { AppShell } from "./AppShell";

export type TabId = "today" | "build" | "plan";

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>("today");
  return <AppShell activeTab={activeTab} onTabChange={setActiveTab} />;
}
