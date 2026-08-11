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
  });
});

describe("Crew owner mutations", () => {
  it("updates only the selected Crew metadata", async () => {
    const { client, chain } = crewTable({ data: { id: "crew-1" }, error: null });
    await updateCrew(client, "crew-1", details);

    expect(chain.update).toHaveBeenCalledWith({
      name: "OUC Race Crew",
      race_name: "OUC Half Marathon",
      race_date: "2026-12-05",
      race_distance_miles: 13.1,
    });
    expect(chain.eq).toHaveBeenCalledWith("id", "crew-1");
    expect(chain.select).toHaveBeenCalledWith("id");
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
