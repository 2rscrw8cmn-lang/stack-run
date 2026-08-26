import { beforeEach, describe, expect, it } from "vitest";
import {
  adoptLegacyIntervalsSyncToken,
  loadIntervalsSyncToken,
  saveIntervalsSyncToken,
} from "./intervalsTokenRepository.js";

describe("legacy Intervals proxy token adoption", () => {
  beforeEach(() => localStorage.clear());

  it("adopts a legacy token into the first signed-in account on this device", () => {
    saveIntervalsSyncToken("legacy-token");
    expect(adoptLegacyIntervalsSyncToken("user-a")).toBe("legacy-token");
    expect(loadIntervalsSyncToken()).toBeNull();
    expect(loadIntervalsSyncToken("user-a")).toBe("legacy-token");
    expect(adoptLegacyIntervalsSyncToken("user-b")).toBeNull();
  });

  it("does not overwrite a scoped token or move its remaining legacy token on account switch", () => {
    saveIntervalsSyncToken("legacy-token");
    saveIntervalsSyncToken("scoped-token", "user-a");
    expect(adoptLegacyIntervalsSyncToken("user-a")).toBe("scoped-token");
    expect(loadIntervalsSyncToken()).toBe("legacy-token");
    expect(adoptLegacyIntervalsSyncToken("user-b")).toBeNull();
    expect(loadIntervalsSyncToken("user-b")).toBeNull();
  });
});
