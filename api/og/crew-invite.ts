// The Crew invite share image.
//
// Messages and the other link previewers are handed a PNG rather than the SVG
// this used to return: iOS would resolve the page's title and then sit on a
// spinner where the card should be. The card itself is drawn in `_render`,
// from the crew's own emblem geometry.
//
// Relative imports carry their `.js` extension because Vercel compiles each
// API file separately and Node's ESM resolver reads the specifier as written.
import {
  formatRaceDetail,
  raceNameOf,
  resolveInvitePreview,
} from "../_crewInvitePreview.js";
import { renderInviteCard } from "../_render/inviteCard.js";

interface NodeResponse {
  statusCode: number;
  setHeader(name: string, value: string | number): void;
  end(body?: Uint8Array): void;
}

interface NodeRequest {
  method?: string;
  url?: string;
}

export default async function handler(request: NodeRequest, response: NodeResponse): Promise<void> {
  // Vercel hands the handler a path rather than an absolute URL; the origin
  // here is only a parsing base and never appears in the response.
  const url = new URL(request.url ?? "/api/og/crew-invite", "https://image.invalid");
  const preview = await resolveInvitePreview(url.searchParams.get("token"));
  const png = renderInviteCard(
    preview && {
      crewName: preview.crewName,
      kind: preview.crewType === "club" ? "RUN CLUB" : "RACE CREW",
      raceName: raceNameOf(preview),
      raceDetail: formatRaceDetail(preview),
      emblem: preview.emblem,
    },
  );

  response.statusCode = 200;
  response.setHeader("Content-Type", "image/png");
  response.setHeader("Content-Length", png.length);
  // The image URL carries the emblem code as its version, so a cache entry can
  // never outlive the emblem it draws. The window is still short: a revoked
  // invite should stop showing a crew's name promptly.
  response.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  response.end(png);
}
