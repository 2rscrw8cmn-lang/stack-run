import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { deleteCrew, updateCrew, validateCrewDetails } from "./crewService";

function crewTable(result: { data: unknown; error: { message: string } | null }) {
  const chain = {
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn(async () => result),
  };
  chain.update.mockReturnValue(chain);
  chain.delete.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  const client = { from: vi.fn(() => chain) } as unknown as SupabaseClient;
  return { client, chain };
}

const details = {
  name: "  OUC Race Crew  ",
  raceName: "  OUC Half Marathon  ",
  raceDate: "2026-12-05",
  raceDistanceMiles: 13.1,
  buildStartDate: "2026-08-01",
};

describe("Crew details validation", () => {
  it("normalizes valid names and rejects invalid fields", () => {
    expect(validateCrewDetails(details)).toEqual({
      ...details,
      name: "OUC Race Crew",
      raceName: "OUC Half Marathon",
    });
    expect(() => validateCrewDetails({ ...details, name: " " })).toThrow("Crew name");
    expect(() => validateCrewDetails({ ...details, raceName: " " })).toThrow("race name");
    expect(() => validateCrewDetails({ ...details, raceDate: "2026-02-30" })).toThrow("valid race date");
    expect(() => validateCrewDetails({ ...details, raceDistanceMiles: 0 })).toThrow("valid race distance");
    expect(() => validateCrewDetails({ ...details, buildStartDate: "2026-02-30" })).toThrow("valid Build start");
    expect(() => validateCrewDetails({ ...details, buildStartDate: "2026-12-06" })).toThrow("after the race date");
  });
});

describe("Crew owner mutations", () => {
  it("uses the atomic owner RPC for metadata and Build start changes", async () => {
    const rpc = vi.fn(async () => ({ data: 0, error: null }));
    const client = { rpc } as unknown as SupabaseClient;
    await updateCrew(client, "crew-1", details);

    expect(rpc).toHaveBeenCalledWith("update_crew", {
      p_crew_id: "crew-1",
      p_name: "OUC Race Crew",
      p_race_name: "OUC Half Marathon",
      p_race_date: "2026-12-05",
      p_race_distance_miles: 13.1,
      p_build_start_date: "2026-08-01",
    });
  });

  it("deletes only the selected Crew and detects denied or stale ownership", async () => {
    const allowed = crewTable({ data: { id: "crew-1" }, error: null });
    await deleteCrew(allowed.client, "crew-1");
    expect(allowed.chain.delete).toHaveBeenCalledOnce();
    expect(allowed.chain.eq).toHaveBeenCalledWith("id", "crew-1");

    const denied = crewTable({ data: null, error: null });
    await expect(deleteCrew(denied.client, "crew-1")).rejects.toThrow("could not be deleted");
  });
});
