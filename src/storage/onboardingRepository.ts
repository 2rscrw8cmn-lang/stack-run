import { ONBOARDING_STORAGE_KEY } from "./storageKeys";

export interface OnboardingState {
  version: 1;
  introSeen: boolean;
  coreTourCompleted: boolean;
  crewTourSeen: boolean;
}

export interface OnboardingSnapshot {
  exists: boolean;
  state: OnboardingState;
}

export const INITIAL_ONBOARDING_STATE: OnboardingState = {
  version: 1,
  introSeen: false,
  coreTourCompleted: false,
  crewTourSeen: false,
};

function isOnboardingState(value: unknown): value is OnboardingState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<OnboardingState>;
  return (
    candidate.version === 1 &&
    typeof candidate.introSeen === "boolean" &&
    typeof candidate.coreTourCompleted === "boolean" &&
    typeof candidate.crewTourSeen === "boolean"
  );
}

/** Lightweight, versioned product education preferences, separate from AppState. */
export function loadOnboarding(): OnboardingSnapshot {
  try {
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (raw === null) {
      return { exists: false, state: INITIAL_ONBOARDING_STATE };
    }
    const parsed: unknown = JSON.parse(raw);
    return isOnboardingState(parsed)
      ? { exists: true, state: parsed }
      : { exists: false, state: INITIAL_ONBOARDING_STATE };
  } catch {
    return { exists: false, state: INITIAL_ONBOARDING_STATE };
  }
}

/** Preference writes are intentionally best-effort; they never block personal STACK. */
export function saveOnboarding(state: OnboardingState): void {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // A failed tour preference is not a failed training-data write.
  }
}
