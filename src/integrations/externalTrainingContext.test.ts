import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  parseExternalTrainingContext,
  readExternalTrainingContext,
} from "./externalTrainingContext";

function contextFixture(): unknown {
  return {
    schemaVersion: 1,
    subject: "authenticated-user",
    asOfDate: "2026-08-24",
    accountStatus: "initialized",
    plan: {
      status: "active",
      activePlan: {
        id: "plan-1",
        name: "Fall Half",
        startDate: "2026-08-01",
        endDate: "2026-10-04",
        race: { name: "Fall Half", date: "2026-10-04", distanceMiles: 13.1 },
      },
      currentAndFutureWorkouts: [
        {
          id: "workout-1",
          date: "2026-08-24",
          weekNumber: 4,
          phase: "Build",
          type: "easy",
          title: "Easy 4",
          targetDistanceMiles: "4",
          details: "Conversational",
        },
      ],
    },
    recentHistory: {
      status: "available",
      coverage: {
        status: "partial",
        windowStart: "2026-05-27",
        windowEnd: "2026-08-24",
        recordLimit: 100,
        truncated: false,
        includedOrigins: ["stack-run-log"],
        historicalSourceMirrorIncluded: false,
        reason: "Source-only history is device-local.",
      },
      runs: [
        {
          id: "run-log:run-1",
          date: "2026-08-23",
          activityKind: "running",
          activityType: "easy",
          distanceMiles: 4,
          durationSeconds: 2400,
          paceSecondsPerMile: 600,
          source: "intervals",
          origin: "stack-run-log",
          historicalReconciliationStatus: "not-observable-from-account-cloud",
          planRelationship: { status: "linked", workoutId: "workout-1" },
          build: { status: "placed" },
          metrics: {
            averageHeartRateBpm: 150,
            maxHeartRateBpm: 170,
            heartRateProvenance: "source-aggregate",
            averageCadence: null,
            elevationGainFeet: null,
            trainingLoad: 42,
            hrZoneSeconds: null,
          },
          crewContributions: [
            {
              crewId: "crew-1",
              memberBuildStatus: "placed",
              crewBuildStatus: "ready",
            },
          ],
        },
      ],
    },
    planAdjustmentHistory: { status: "not-available", entries: [] },
  };
}

describe("external training context", () => {
  it("parses the provider-neutral v1 contract", () => {
    const context = parseExternalTrainingContext(contextFixture());

    expect(context.plan.status).toBe("active");
    expect(context.recentHistory.runs[0]).toMatchObject({
      id: "run-log:run-1",
      source: "intervals",
      build: { status: "placed" },
    });
    expect(context.recentHistory.coverage.historicalSourceMirrorIncluded).toBe(false);
  });

  it("fails closed when the server shape drifts", () => {
    const fixture = contextFixture() as {
      recentHistory: { coverage: { historicalSourceMirrorIncluded: boolean } };
    };
    fixture.recentHistory.coverage.historicalSourceMirrorIncluded = true;

    expect(() => parseExternalTrainingContext(fixture)).toThrow(
      "External training context did not match schema version 1.",
    );
  });

  it("binds the read to the current session without accepting a user id", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: contextFixture(), error: null });
    const client = { rpc } as unknown as SupabaseClient;

    await expect(readExternalTrainingContext(client, "2026-08-24")).resolves.toMatchObject({
      subject: "authenticated-user",
      asOfDate: "2026-08-24",
    });
    expect(rpc).toHaveBeenCalledWith("read_external_training_context", {
      p_as_of_date: "2026-08-24",
    });
  });

  it("rejects an invalid local as-of date before calling Supabase", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as SupabaseClient;

    await expect(readExternalTrainingContext(client, "08/24/2026")).rejects.toThrow(
      "valid local as-of date",
    );
    expect(rpc).not.toHaveBeenCalled();
  });
});
