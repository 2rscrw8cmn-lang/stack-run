import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CREW_EMBLEM, encodeCrewEmblem } from "../src/crew/emblem.js";
import crewInviteHandler from "./crew-invite.js";
import crewInviteImageHandler from "./og/crew-invite.js";
import {
  formatRace,
  formatRaceDetail,
  raceNameOf,
  resolveInvitePreview,
  type InvitePreview,
} from "./_crewInvitePreview.js";

const TOKEN = "abcdefghijklmnopqrstuvwxyz123456";

const base: InvitePreview = {
  crewId: "crew-1",
  crewName: "Brick by Brick",
  crewType: "race",
  raceName: "Orlando Half Marathon",
  raceDate: "2026-12-05",
  raceDistanceMiles: 13.1,
  emblem: DEFAULT_CREW_EMBLEM,
  emblemVersion: encodeCrewEmblem(DEFAULT_CREW_EMBLEM),
};

const club: InvitePreview = {
  ...base,
  crewType: "club",
  raceName: null,
  raceDate: null,
  raceDistanceMiles: null,
};

/** Enough of Vercel's Node response to see what a handler produced. */
function capture() {
  const headers: Record<string, string> = {};
  let body: string | Uint8Array | undefined;
  return {
    headers,
    get body() {
      return body;
    },
    response: {
      statusCode: 0,
      setHeader: (name: string, value: string | number) => {
        headers[name.toLowerCase()] = String(value);
      },
      end: (value?: string & Uint8Array) => {
        body = value;
      },
    },
  };
}

describe("Crew invite preview metadata", () => {
  it("refuses a production Supabase reader on a Vercel Preview", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const result = await resolveInvitePreview(
      TOKEN,
      {
        VERCEL_ENV: "preview",
        STACK_BACKEND_ENV: "production",
        SUPABASE_URL: "https://fgnecruhlybarcmljggi.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fake",
      },
      fetcher,
    );
    expect(result).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("allows the Preview invite reader only against stack-run-preview", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            crew_id: base.crewId,
            crew_name: base.crewName,
            crew_type: base.crewType,
            race_name: base.raceName,
            race_date: base.raceDate,
            race_distance_miles: base.raceDistanceMiles,
          },
        ]),
        { status: 200 },
      ),
    );
    const result = await resolveInvitePreview(
      TOKEN,
      {
        VERCEL_ENV: "preview",
        VITE_STACK_BACKEND_ENV: "preview",
        VITE_SUPABASE_URL: "https://plpooikvofzytbpsbzki.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fake",
      },
      fetcher,
    );
    expect(result).toMatchObject({ crewId: base.crewId, crewName: base.crewName });
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("plpooikvofzytbpsbzki.supabase.co");
  });

  it("keeps the race context for a Race Crew", () => {
    expect(raceNameOf(base)).toBe("Orlando Half Marathon");
    expect(formatRaceDetail(base)).toBe("Dec 5, 2026 · 13.1 mi");
    expect(formatRace(base)).toBe("Orlando Half Marathon · Dec 5, 2026 · 13.1 mi");
  });

  it("omits race context entirely for a Run Club", () => {
    expect(raceNameOf(club)).toBeNull();
    expect(formatRaceDetail(club)).toBeNull();
    expect(formatRace(club)).toBeNull();
  });

  it("falls back to the stored date when it is not a date at all", () => {
    expect(formatRaceDetail({ ...base, raceDate: "someday" })).toBe("someday · 13.1 mi");
  });

  it("adapts Vercel's Node invite invocation and preserves the public origin", async () => {
    const captured = capture();
    await crewInviteHandler(
      {
        method: "GET",
        url: `/api/crew-invite?token=${TOKEN}`,
        headers: { host: "preview.stack.run", "x-forwarded-proto": "https" },
      },
      captured.response,
    );
    expect(captured.response.statusCode).toBe(200);
    expect(captured.body).toContain(`https://preview.stack.run/?join=${TOKEN}`);
  });

  it("shares the invite's own URL, not the app URL it redirects to", async () => {
    const captured = capture();
    await crewInviteHandler(
      { method: "GET", url: `/api/crew-invite?token=${TOKEN}`, headers: { host: "stack.run" } },
      captured.response,
    );
    expect(captured.body).toContain(
      `<meta property="og:url" content="https://stack.run/join/${TOKEN}">`,
    );
    expect(captured.body).toContain(`<link rel="canonical" href="https://stack.run/join/${TOKEN}">`);
  });

  it("declares the share image as a PNG at the size previewers expect", async () => {
    const captured = capture();
    await crewInviteHandler(
      { method: "GET", url: `/api/crew-invite?token=${TOKEN}`, headers: { host: "stack.run" } },
      captured.response,
    );
    expect(captured.body).toContain('<meta property="og:image:type" content="image/png">');
    expect(captured.body).toContain('<meta property="og:image:width" content="1200">');
    expect(captured.body).toContain('<meta property="og:image:height" content="630">');
    expect(captured.body).toContain('<meta name="twitter:card" content="summary_large_image">');
  });

  it("exposes only the generic STACK fallback for an invite it cannot resolve", async () => {
    const captured = capture();
    await crewInviteHandler(
      { method: "GET", url: "/api/crew-invite?token=not-a-token", headers: { host: "stack.run" } },
      captured.response,
    );
    expect(captured.body).toContain("<title>Join a Crew on STACK</title>");
    expect(captured.body).toContain(
      '<meta property="og:image" content="https://stack.run/api/og/crew-invite">',
    );
    expect(captured.headers["cache-control"]).toBe("private, no-store");
  });

  it("returns the share image as a PNG", async () => {
    const captured = capture();
    await crewInviteImageHandler(
      { method: "GET", url: `/api/og/crew-invite?token=${TOKEN}` },
      captured.response,
    );
    expect(captured.response.statusCode).toBe(200);
    expect(captured.headers["content-type"]).toBe("image/png");
    const body = captured.body as Uint8Array;
    expect([...body.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(captured.headers["content-length"]).toBe(String(body.length));
    expect(captured.headers["cache-control"]).toContain("max-age=300");
  });

  it("adapts Vercel's Node image invocation instead of treating its path as a URL", async () => {
    const captured = capture();
    await crewInviteImageHandler({ method: "GET", url: "/api/og/crew-invite" }, captured.response);
    expect(captured.response.statusCode).toBe(200);
    expect((captured.body as Uint8Array).length).toBeGreaterThan(0);
  });
});
