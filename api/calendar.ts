/**
 * Reads a calendar link on the page's behalf.
 *
 * This is the only server-side code in STACK, and it exists for one reason: a
 * browser cannot read a cross-origin response unless the host it asked sends
 * `Access-Control-Allow-Origin`, and rostering systems do not. The page tries
 * the link directly first; when the browser is refused, it asks here, where
 * the same-origin rule does not apply.
 *
 * What it deliberately is not: it stores nothing, logs nothing, reads no
 * request beyond the link, and returns nothing that is not a calendar. The
 * link arrives in a POST body rather than a query string so it stays out of
 * request logs — a subscription link is a standing credential.
 */

export const config = { runtime: "nodejs" };

/** A roster is tens of kilobytes. This is a ceiling, not a target. */
const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function plain(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Refuses addresses that are not on the public internet.
 *
 * An endpoint that fetches whatever it is told to is a way into whatever the
 * server itself can reach, so loopback, link-local and private ranges are out.
 * This checks the address as written; a hostname that resolves to a private
 * address still gets through, which is why the response is also required to
 * look like a calendar before any of it is handed back.
 */
function isPrivateAddress(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }

  const parts = IPV4.exec(host);
  if (parts) {
    const first = Number(parts[1]);
    const second = Number(parts[2]);
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      first >= 224
    );
  }

  if (host.includes(":")) {
    // Unspecified, loopback, unique-local (fc00::/7) and link-local (fe80::/10).
    return host === "::" || host === "::1" || /^f[cd]/.test(host) || /^fe[89ab]/.test(host);
  }

  return false;
}

/** Reads the body, giving up rather than buffering something enormous. */
async function readCapped(response: Response): Promise<string | null> {
  const body = response.body;
  if (!body) {
    return "";
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const joined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(joined);
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return plain(405, 'Send the calendar link in a POST body: {"url": "https://…"}.');
  }

  let target: URL;
  try {
    const body: unknown = await request.json();
    const link =
      typeof body === "object" && body !== null && "url" in body
        ? (body as { url: unknown }).url
        : null;
    if (typeof link !== "string") {
      throw new Error("no link");
    }
    target = new URL(link.trim());
  } catch {
    return plain(400, "That request did not contain a calendar link.");
  }

  if (target.protocol !== "https:") {
    return plain(400, "Calendar links must be https.");
  }

  // Redirects are followed by hand so every hop is checked, not just the first.
  let current = target;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (isPrivateAddress(current.hostname)) {
      return plain(400, "That link does not point at a public calendar host.");
    }

    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { Accept: "text/calendar, text/plain;q=0.9" },
      });
    } catch {
      return plain(502, "Could not reach that calendar host.");
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        return plain(502, "That link redirected to nowhere.");
      }
      try {
        current = new URL(location, current);
      } catch {
        return plain(502, "That link redirected somewhere unreadable.");
      }
      if (current.protocol !== "https:") {
        return plain(400, "That link redirected off https.");
      }
      continue;
    }

    if (!response.ok) {
      return plain(
        502,
        `That link answered ${response.status}. Check it is the current subscription link.`,
      );
    }

    const text = await readCapped(response);
    if (text === null) {
      return plain(502, "That calendar is too large to read.");
    }
    if (!text.toUpperCase().includes("BEGIN:VCALENDAR")) {
      // Also what stops this being a general-purpose fetcher for other pages.
      return plain(502, "That link did not return a calendar.");
    }

    return new Response(text, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  return plain(502, "That link redirected too many times.");
}
