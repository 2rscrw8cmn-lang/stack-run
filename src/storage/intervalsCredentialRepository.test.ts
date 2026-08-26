import { beforeEach, describe, expect, it } from "vitest";
import { createInitialAppState } from "./migrations.js";
import {
  forgetIntervalsApiKey,
  adoptLegacyIntervalsApiKey,
  loadIntervalsApiKey,
  saveIntervalsApiKey,
} from "./intervalsCredentialRepository.js";
import {
  APP_STATE_STORAGE_KEY,
  INTERVALS_API_KEY_STORAGE_KEY,
} from "./storageKeys.js";

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

  it("scopes device-local keys to the signed-in account on a shared browser", () => {
    saveIntervalsApiKey("fake-key-a", "user-a");
    saveIntervalsApiKey("fake-key-b", "user-b");

    expect(loadIntervalsApiKey("user-a")).toBe("fake-key-a");
    expect(loadIntervalsApiKey("user-b")).toBe("fake-key-b");
    expect(loadIntervalsApiKey()).toBeNull();

    forgetIntervalsApiKey("user-a");
    expect(loadIntervalsApiKey("user-a")).toBeNull();
    expect(loadIntervalsApiKey("user-b")).toBe("fake-key-b");
  });

  it("moves a legacy device key into exactly one explicitly initialized account", () => {
    saveIntervalsApiKey("legacy-device-key");
    expect(adoptLegacyIntervalsApiKey("user-a")).toBe("legacy-device-key");
    expect(loadIntervalsApiKey()).toBeNull();
    expect(loadIntervalsApiKey("user-a")).toBe("legacy-device-key");
    expect(adoptLegacyIntervalsApiKey("user-b")).toBeNull();
    expect(loadIntervalsApiKey("user-b")).toBeNull();
  });

  it("does not overwrite a scoped key or expose the remaining legacy key after account switching", () => {
    saveIntervalsApiKey("legacy-local-key");
    saveIntervalsApiKey("already-scoped-a", "user-a");

    expect(adoptLegacyIntervalsApiKey("user-a")).toBe("already-scoped-a");
    expect(loadIntervalsApiKey()).toBe("legacy-local-key");
    expect(adoptLegacyIntervalsApiKey("user-b")).toBeNull();
    expect(loadIntervalsApiKey("user-b")).toBeNull();
    expect(loadIntervalsApiKey()).toBe("legacy-local-key");
  });
});
