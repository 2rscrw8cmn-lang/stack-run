import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { AppErrorBoundary } from "./app/AppErrorBoundary";
import { GettingStartedPage } from "./features/help/GettingStartedPage";
import { installHistoryDiagnostics } from "./history/historyDiagnostics";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/components.css";

/**
 * Off unless this device has explicitly opted in, and it adds no capability a
 * connected device did not already have. See `history/historyDiagnostics.ts`.
 */
installHistoryDiagnostics();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
const content = pathname === "/getting-started" ? <GettingStartedPage /> : <App />;

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      {content}
    </AppErrorBoundary>
  </StrictMode>,
);
