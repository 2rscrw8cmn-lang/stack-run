import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppErrorBoundary } from "./app/AppErrorBoundary.js";
import { GettingStartedPage } from "./features/help/GettingStartedPage.js";
import { PinRecoveryPage } from "./features/crew/PinRecoveryPage.js";
import { installHistoryDiagnostics } from "./history/historyDiagnostics.js";
import { QaRunnerRoot } from "./qa/QaRunnerRoot.js";
import { STACK_PIN_FORGOT_PATH, STACK_PIN_RESET_PATH } from "./crew/authRoutes.js";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/runsIntegration.css";

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
const content =
  pathname === "/getting-started"
    ? <GettingStartedPage />
    : pathname === STACK_PIN_FORGOT_PATH || pathname === STACK_PIN_RESET_PATH
      ? <PinRecoveryPage />
      : <QaRunnerRoot />;

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>{content}</AppErrorBoundary>
  </StrictMode>,
);
