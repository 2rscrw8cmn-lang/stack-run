import { beforeEach, describe, expect, it } from "vitest";
import { createSeededAppState } from "./migrations";
import {
  accountAppStateStorageKey,
  backupPersonalState,
  emptyPersonalOutbox,
  hasPersonalOutboxWork,
  loadAccountAppState,
  loadPersonalMetadata,
  loadPersonalOutbox,
  saveAccountAppState,
  savePersonalMetadata,
  savePersonalOutbox,
} from "./personalSyncRepository";

beforeEach(() => localStorage.clear());

describe("account-scoped personal cache", () => {
  it("keeps two accounts' plans, runs and Builds in separate browser slots", () => {
    const first = structuredClone(createSeededAppState());
    first.plan.name = "Account A";
    const second = structuredClone(createSeededAppState());
    second.plan.name = "Account B";
    saveAccountAppState("user-a", first);
    saveAccountAppState("user-b", second);

    expect(loadAccountAppState("user-a")?.plan?.name).toBe("Account A");
    expect(loadAccountAppState("user-b")?.plan?.name).toBe("Account B");
    expect(accountAppStateStorageKey("user-a")).not.toBe(accountAppStateStorageKey("user-b"));
  });

  it("retains a valid account cache when another cached payload is malformed", () => {
    const valid = createSeededAppState();
    valid.plan.name = "Still safe";
    saveAccountAppState("valid-user", valid);
    localStorage.setItem(accountAppStateStorageKey("broken-user"), "{bad json");

    expect(loadAccountAppState("broken-user")).toBeNull();
    expect(loadAccountAppState("valid-user")?.plan?.name).toBe("Still safe");
  });

  it("creates a recoverable pre-reconciliation backup with its owner and reason", () => {
    const key = backupPersonalState("user-a", createSeededAppState(), "before adoption");
    expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject({
      userId: "user-a",
      reason: "before adoption",
      state: { schemaVersion: 11 },
    });
  });
});

describe("persistent personal outbox", () => {
  it("persists offline work by account and removes an empty queue", () => {
    const outbox = emptyPersonalOutbox();
    outbox.runs["run-offline"] = { kind: "upsert", expectedRevision: 0 };
    outbox.generation += 1;
    savePersonalOutbox("user-a", outbox);

    expect(hasPersonalOutboxWork(loadPersonalOutbox("user-a"))).toBe(true);
    expect(hasPersonalOutboxWork(loadPersonalOutbox("user-b"))).toBe(false);

    savePersonalOutbox("user-a", emptyPersonalOutbox());
    expect(hasPersonalOutboxWork(loadPersonalOutbox("user-a"))).toBe(false);
  });

  it("tracks a newer mutation generation even when two edits share a millisecond", () => {
    const first = emptyPersonalOutbox();
    first.updatedAt = "2026-08-13T12:00:00.000Z";
    first.generation = 1;
    first.training = true;
    savePersonalOutbox("user-a", first);
    const second = loadPersonalOutbox("user-a");
    second.generation += 1;
    second.updatedAt = first.updatedAt;
    savePersonalOutbox("user-a", second);
    expect(loadPersonalOutbox("user-a").generation).toBe(2);
  });

  it("falls back safely when revision metadata is malformed", () => {
    localStorage.setItem("stack.personal-cache-meta.v1.user-a", "{broken");
    expect(loadPersonalMetadata("user-a")).toMatchObject({
      initialized: false,
      revisions: { training: 0, build: 0, intervals: 0, runs: {} },
    });
  });

  it("round-trips independent revisions used for cross-device edits", () => {
    const metadata = loadPersonalMetadata("user-a");
    metadata.initialized = true;
    metadata.revisions = { training: 3, build: 5, intervals: 2, runs: { "run-1": 7 } };
    savePersonalMetadata("user-a", metadata);
    expect(loadPersonalMetadata("user-a").revisions).toEqual(metadata.revisions);
  });
});
