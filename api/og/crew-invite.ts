import { crewEmblemSvgMarkup } from "../../src/crew/emblem";
import { stackMarkSvgMarkup } from "../../src/components/shared/stackMarkSvg";
import { escapeHtml, formatRace, resolveInvitePreview } from "../crewInvitePreview";

function svg(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=300, s-maxage=300" } });
}

export default async function handler(request: Request): Promise<Response> {
  const preview = await resolveInvitePreview(new URL(request.url).searchParams.get("token"));
  if (!preview) return svg('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#05080a"/><text x="84" y="330" fill="#f5f7f8" font-family="Arial, sans-serif" font-size="64" font-weight="700">STACK</text></svg>');
  const race = formatRace(preview);
  const name = escapeHtml(preview.crewName);
  const kind = preview.crewType === "club" ? "RUN CLUB" : "PRIVATE RACE CREW INVITE";
  return svg(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="fade" x1="0" x2="1"><stop stop-color="#071015"/><stop offset="1" stop-color="#05080a"/></linearGradient><pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#173029" stroke-opacity=".55" stroke-width="1"/></pattern></defs><rect width="1200" height="630" fill="url(#fade)"/><rect width="1200" height="630" fill="url(#grid)"/><rect x="58" y="58" width="3" height="514" fill="#7ddc3a"/><svg x="108" y="154" width="300" height="300" viewBox="0 0 180 180">${crewEmblemSvgMarkup(preview.emblem)}</svg><g font-family="Arial, Helvetica, sans-serif" fill="#f5f7f8"><text x="490" y="150" font-family="monospace" font-size="24" font-weight="700" letter-spacing="4" fill="#9fb0ae">${kind}</text><text x="490" y="250" font-size="70" font-weight="800">${name}</text>${race ? `<text x="490" y="322" font-size="31" fill="#b8c4c2">${escapeHtml(race)}</text>` : ""}<g transform="translate(490 452)"><svg width="34" height="34" viewBox="0 0 24 24">${stackMarkSvgMarkup()}</svg><text x="52" y="27" font-size="30" font-weight="700">Join on STACK</text></g></g></svg>`);
}
