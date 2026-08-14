import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  createCrew,
  deleteCrew,
  loadCrewAccount,
  updateAccentColor,
  updateCrew,
  updateRunnerIcon,
  validateCrewDetails,
} from "./crewService";
import { crewMemberAccent } from "./memberAccent";
import { runnerIconFromSeed } from "./runnerIcon";
import {
  DEFAULT_CREW_EMBLEM,
  crewEmblemFromSeed,
  decodeCrewEmblem,
  encodeCrewEmblem,
} from "./emblem";

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

/** `updateAccentColor`/`updateDisplayName` resolve straight off `.eq(...)`, with no `.select()`. */
function profilesTable(result: { error: { message: string } | null }) {
  const chain = {
    update: vi.fn(),
    eq: vi.fn(async () => result),
  };
  chain.update.mockReturnValue(chain);
  const client = { from: vi.fn(() => chain) } as unknown as SupabaseClient;
  return { client, chain };
}

const details = {
  name: "  OUC Race Crew  ",
  crewType: "race" as const,
  raceName: "  OUC Half Marathon  ",
  raceDate: "2026-12-05",
  raceDistanceMiles: 13.1,
  buildStartDate: "2026-08-01",
  emblem: DEFAULT_CREW_EMBLEM,
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

  it("never requires or persists race fields for a Run Club", () => {
    const club = {
      name: "  Thursday Run Club  ",
      crewType: "club" as const,
      raceName: null,
      raceDate: null,
      raceDistanceMiles: null,
      buildStartDate: "2026-08-01",
      emblem: DEFAULT_CREW_EMBLEM,
    };
    expect(validateCrewDetails(club)).toEqual({
      ...club,
      name: "Thursday Run Club",
    });
    // Even a caller that fills in leftover race fields never sees them survive.
    expect(
      validateCrewDetails({
        ...club,
        raceName: "Not A Real Race",
        raceDate: "2026-12-05",
        raceDistanceMiles: 13.1,
      }),
    ).toEqual({ ...club, name: "Thursday Run Club" });
    expect(() =>
      validateCrewDetails({ ...club, buildStartDate: "2026-02-30" }),
    ).toThrow("valid Build start");
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
      p_emblem: encodeCrewEmblem(DEFAULT_CREW_EMBLEM),
    });
  });

  it("sends the Crew type on creation, race or club", async () => {
    const rpc = vi.fn(async () => ({ data: "crew-9", error: null }));
    const client = { rpc } as unknown as SupabaseClient;
    await createCrew(client, details);

    expect(rpc).toHaveBeenCalledWith("create_crew", {
      p_name: "OUC Race Crew",
      p_crew_type: "race",
      p_race_name: "OUC Half Marathon",
      p_race_date: "2026-12-05",
      p_race_distance_miles: 13.1,
      p_build_start_date: "2026-08-01",
      p_emblem: encodeCrewEmblem(DEFAULT_CREW_EMBLEM),
    });

    await createCrew(client, {
      name: "Thursday Run Club",
      crewType: "club",
      raceName: null,
      raceDate: null,
      raceDistanceMiles: null,
      buildStartDate: "2026-08-01",
      emblem: DEFAULT_CREW_EMBLEM,
    });
    expect(rpc).toHaveBeenLastCalledWith("create_crew", {
      p_name: "Thursday Run Club",
      p_crew_type: "club",
      p_race_name: null,
      p_race_date: null,
      p_race_distance_miles: null,
      p_build_start_date: "2026-08-01",
      p_emblem: encodeCrewEmblem(DEFAULT_CREW_EMBLEM),
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

describe("Accent color", () => {
  it("saves an explicit pick to the caller's own profile", async () => {
    const { client, chain } = profilesTable({ error: null });
    await updateAccentColor(client, "user-1", "magenta");

    expect(chain.update).toHaveBeenCalledWith({ accent_color: "magenta" });
    expect(chain.eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("surfaces the database's own collision message rather than inventing one", async () => {
    const { client } = profilesTable({
      error: { message: "That color is already taken by another crew member." },
    });
    await expect(updateAccentColor(client, "user-1", "magenta")).rejects.toThrow(
      "already taken by another crew member",
    );
  });
});

describe("Runner Icon", () => {
  it("persists approved option identifiers as a code, never markup", async () => {
    const { client, chain } = profilesTable({ error: null });
    await updateRunnerIcon(client, "user-1", { head: 1, face: 3, body: 5, flair: 2, background: 4 });

    expect(chain.update).toHaveBeenCalledWith({ runner_icon: "R2-1.3.5.2.4" });
    expect(chain.eq).toHaveBeenCalledWith("id", "user-1");
  });

  /**
   * The service encodes rather than accepting a string, so the only thing
   * that can reach this column is five validated indices — a caller cannot
   * smuggle SVG through it even by mistake.
   */
  it("clamps an out-of-range part instead of writing it", async () => {
    const { client, chain } = profilesTable({ error: null });
    await updateRunnerIcon(client, "user-1", { head: 99, face: 0, body: 0, flair: 0, background: 0 });

    expect(chain.update).toHaveBeenCalledWith({ runner_icon: "R2-0.0.0.0.0" });
  });

  it("surfaces a database rejection rather than reporting success", async () => {
    const { client } = profilesTable({ error: { message: "violates check constraint" } });
    await expect(
      updateRunnerIcon(client, "user-1", { head: 0, face: 0, body: 0, flair: 0, background: 0 }),
    ).rejects.toThrow("violates check constraint");
  });
});

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

/**
 * A minimal PostgREST stand-in: every builder method returns the chain, and
 * awaiting it (or `.maybeSingle()`) shifts the next canned answer for that
 * table. Enough to prove the shape of the reads without a live database.
 */
function fakeClient(responses: Record<string, QueryResult[]>) {
  const tables: string[] = [];
  function chainFor(table: string) {
    const queue = responses[table] ?? [];
    const next = (): QueryResult => queue.shift() ?? { data: [], error: null };
    const chain = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => next(),
      single: async () => next(),
      then: <T>(
        resolve: (value: QueryResult) => T,
        reject?: (reason: unknown) => T,
      ) => Promise.resolve(next()).then(resolve, reject),
    };
    return chain;
  }
  const client = {
    from: (table: string) => {
      tables.push(table);
      return chainFor(table);
    },
  } as unknown as SupabaseClient;
  return { client, tables };
}

const user = { id: "user-1", user_metadata: {} } as unknown as Parameters<typeof loadCrewAccount>[1];

function crewRow(id: string, name: string, emblem: string | null) {
  return {
    id,
    owner_user_id: "user-1",
    name,
    crew_type: "race",
    race_name: "Race",
    race_date: "2026-12-05",
    race_distance_miles: 13.1,
    build_start_date: "2026-08-01",
    emblem,
  };
}

function multiCrewResponses(): Record<string, QueryResult[]> {
  return {
    profiles: [
      {
        data: {
          id: "user-1",
          display_name: "Runner",
          accent_color: "magenta",
          runner_icon: "R1-1.3.5.2",
        },
        error: null,
      },
      {
        data: [
          { id: "user-1", display_name: "Runner", accent_color: "magenta", runner_icon: "R1-1.3.5.2" },
          { id: "user-2", display_name: "Second", accent_color: "sky" },
          { id: "user-3", display_name: "Third", accent_color: null },
        ],
        error: null,
      },
    ],
    crew_members: [
      {
        data: [
          { crew_id: "crew-1", role: "owner", joined_at: "2026-08-01T00:00:00Z" },
          { crew_id: "crew-2", role: "member", joined_at: "2026-09-01T00:00:00Z" },
        ],
        error: null,
      },
      {
        data: [
          { crew_id: "crew-1", user_id: "user-1", role: "owner", joined_at: "2026-08-01T00:00:00Z" },
          { crew_id: "crew-1", user_id: "user-3", role: "member", joined_at: "2026-08-03T00:00:00Z" },
          { crew_id: "crew-2", user_id: "user-2", role: "owner", joined_at: "2026-07-01T00:00:00Z" },
          { crew_id: "crew-2", user_id: "user-1", role: "member", joined_at: "2026-09-01T00:00:00Z" },
        ],
        error: null,
      },
    ],
    crews: [
      {
        data: [
          crewRow("crew-1", "Road Crew", "E1-1.2-3.0-5.4-2.1"),
          crewRow("crew-2", "Trail Crew", null),
        ],
        error: null,
      },
    ],
    crew_invites: [{ data: [], error: null }],
  };
}

describe("Loading an account with more than one crew", () => {
  it("keeps every membership and views the remembered crew", async () => {
    const { client } = fakeClient(multiCrewResponses());
    const account = await loadCrewAccount(client, user, "crew-2");

    expect(account.memberships.map((item) => item.crew.name)).toEqual([
      "Road Crew",
      "Trail Crew",
    ]);
    expect(account.memberships.map((item) => item.role)).toEqual(["owner", "member"]);
    expect(account.crew?.id).toBe("crew-2");
    expect(account.role).toBe("member");
    // The roster is the viewed crew's, not a merge of every crew.
    expect(account.members.map((member) => member.userId)).toEqual(["user-2", "user-1"]);
  });

  it("falls back to the oldest membership when the remembered crew is gone", async () => {
    const { client } = fakeClient(multiCrewResponses());
    const account = await loadCrewAccount(client, user, "crew-left-last-week");

    expect(account.crew?.id).toBe("crew-1");
    expect(account.role).toBe("owner");
    expect(account.memberships).toHaveLength(2);
  });

  it("resolves each crew's emblem, saved or derived", async () => {
    const { client } = fakeClient(multiCrewResponses());
    const account = await loadCrewAccount(client, user, "crew-1");

    expect(account.memberships[0].crew.emblem).toEqual(
      decodeCrewEmblem("E1-1.2-3.0-5.4-2.1"),
    );
    expect(account.memberships[1].crew.emblem).toEqual(crewEmblemFromSeed("crew-2"));
  });

  /**
   * The union spans crews, covers explicit picks and the stable hash a runner
   * who has never opened the picker still renders with, and never includes
   * the viewer's own color.
   */
  /**
   * A saved icon decodes; a crewmate who has never built one still renders,
   * from their user id. Neither case is allowed to leave a member without a
   * mark, because Crew UI draws one for everybody.
   */
  it("resolves a runner icon for every member, saved or derived", async () => {
    const { client } = fakeClient(multiCrewResponses());
    const account = await loadCrewAccount(client, user, "crew-1");

    expect(account.profile.runnerIcon).toEqual({ head: 1, face: 3, body: 5, flair: 2, background: 0 });
    const roster = new Map(account.members.map((member) => [member.userId, member.runnerIcon]));
    expect(roster.get("user-1")).toEqual({ head: 1, face: 3, body: 5, flair: 2, background: 0 });
    expect(roster.get("user-3")).toEqual(runnerIconFromSeed("user-3"));
  });

  it("collects taken accent colors across every crew, excluding the viewer", async () => {
    const { client } = fakeClient(multiCrewResponses());
    const account = await loadCrewAccount(client, user, "crew-1");

    expect(new Set(account.takenAccentColors)).toEqual(
      new Set(["sky", crewMemberAccent("user-3", null)]),
    );
    expect(account.takenAccentColors).not.toContain("magenta");
  });

  it("reports no crew for an account that is in none", async () => {
    const { client } = fakeClient({
      profiles: [{ data: { id: "user-1", display_name: "Runner", accent_color: null }, error: null }],
      crew_members: [{ data: [], error: null }],
    });
    const account = await loadCrewAccount(client, user, "crew-1");

    expect(account.memberships).toEqual([]);
    expect(account.crew).toBeNull();
    expect(account.takenAccentColors).toEqual([]);
  });

  it("loads a Run Club with null race fields rather than inventing a race", async () => {
    const { client } = fakeClient({
      profiles: [
        { data: { id: "user-1", display_name: "Runner", accent_color: null }, error: null },
        { data: [{ id: "user-1", display_name: "Runner", accent_color: null }], error: null },
      ],
      crew_members: [
        { data: [{ crew_id: "club-1", role: "owner", joined_at: "2026-08-01T00:00:00Z" }], error: null },
        { data: [{ crew_id: "club-1", user_id: "user-1", role: "owner", joined_at: "2026-08-01T00:00:00Z" }], error: null },
      ],
      crews: [
        {
          data: [{
            id: "club-1",
            owner_user_id: "user-1",
            name: "Thursday Run Club",
            crew_type: "club",
            race_name: null,
            race_date: null,
            race_distance_miles: null,
            build_start_date: "2026-08-01",
            emblem: null,
          }],
          error: null,
        },
      ],
      crew_invites: [{ data: [], error: null }],
    });
    const account = await loadCrewAccount(client, user, "club-1");

    expect(account.crew?.crewType).toBe("club");
    expect(account.crew?.raceName).toBeNull();
    expect(account.crew?.raceDate).toBeNull();
    expect(account.crew?.raceDistanceMiles).toBeNull();
  });
});
