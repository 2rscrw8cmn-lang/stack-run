import { beforeEach, describe, expect, it } from "vitest";
import { ONBOARDING_STORAGE_KEY } from "./storageKeys";
import { INITIAL_ONBOARDING_STATE, loadOnboarding, saveOnboarding } from "./onboardingRepository";

beforeEach(() => localStorage.clear());

describe("onboarding preferences", () => {
  it("starts fresh without changing personal AppState", () => {
    expect(loadOnboarding()).toEqual({ exists: false, state: INITIAL_ONBOARDING_STATE });
  });

  it("persists the versioned intro, core tour and Crew flags", () => {
    const state = {
      version: 1 as const,
      introSeen: true,
      coreTourCompleted: true,
      crewTourSeen: false,
    };
    saveOnboarding(state);
    expect(loadOnboarding()).toEqual({ exists: true, state });
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toContain('"version":1');
  });

  it("ignores malformed or future preference data", () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({ version: 2 }));
    expect(loadOnboarding()).toEqual({ exists: false, state: INITIAL_ONBOARDING_STATE });
  });
});
