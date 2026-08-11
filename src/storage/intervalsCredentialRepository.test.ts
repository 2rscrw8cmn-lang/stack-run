import { beforeEach, describe, expect, it } from "vitest";
import { createInitialAppState } from "./migrations";
import {
  forgetIntervalsApiKey,
  loadIntervalsApiKey,
  saveIntervalsApiKey,
} from "./intervalsCredentialRepository";
import {
  APP_STATE_STORAGE_KEY,
  INTERVALS_API_KEY_STORAGE_KEY,
} from "./storageKeys";

describe("Intervals credential repository", () => {
  beforeEach(() => localStorage.clear());

  it("trims and stores the key outside AppState", () => {
    localStorage.setItem(
      APP_STATE_STORAGE_KEY,
      JSON.stringify(createInitialAppState()),
    );

    saveIntervalsApiKey("  fake-personal-key  ");

    expect(loadIntervalsApiKey()).toBe("fake-personal-key");
    expect(localStorage.getItem(INTERVALS_API_KEY_STORAGE_KEY)).toBe(
      "fake-personal-key",
    );
    expect(localStorage.getItem(APP_STATE_STORAGE_KEY)).not.toContain(
      "fake-personal-key",
    );
  });

  it("forgets only the connection", () => {
    localStorage.setItem(APP_STATE_STORAGE_KEY, "personal-state");
    saveIntervalsApiKey("fake-personal-key");
    forgetIntervalsApiKey();

    expect(loadIntervalsApiKey()).toBeNull();
    expect(localStorage.getItem(APP_STATE_STORAGE_KEY)).toBe("personal-state");
  });
});
