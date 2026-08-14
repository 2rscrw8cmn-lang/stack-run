const JOIN_FRAGMENT_KEY = "join";
const PENDING_INVITE_STORAGE_KEY = "stack.crew.pending-invite.v1";

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function createInviteToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function hashInviteToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function inviteTokenFromHash(hash: string): string | null {
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  const value = new URLSearchParams(fragment).get(JOIN_FRAGMENT_KEY)?.trim();
  return value || null;
}

export function inviteUrl(token: string, location: Location = window.location): string {
  // A path is deliberate: the invitation function must receive the token in
  // the first request so Messages and other Open Graph clients can see the
  // Crew-specific metadata before the React app starts.
  return `${location.origin}/join/${encodeURIComponent(token)}`;
}

export function rememberPendingInvite(token: string): void {
  sessionStorage.setItem(PENDING_INVITE_STORAGE_KEY, token);
}

export function loadPendingInvite(): string | null {
  return sessionStorage.getItem(PENDING_INVITE_STORAGE_KEY);
}

export function clearPendingInvite(): void {
  sessionStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
}

export function inviteTokenFromLocation(location: Location = window.location): string | null {
  const fromPath = /^\/join\/([^/?#]+)$/.exec(location.pathname)?.[1];
  const fromQuery = new URLSearchParams(location.search).get(JOIN_FRAGMENT_KEY)?.trim();
  return fromPath ? decodeURIComponent(fromPath) : fromQuery || inviteTokenFromHash(location.hash);
}

export function captureInviteFromLocation(location: Location = window.location): string | null {
  const token = inviteTokenFromLocation(location);
  if (!token) return loadPendingInvite();
  rememberPendingInvite(token);
  const query = new URLSearchParams(location.search);
  query.delete(JOIN_FRAGMENT_KEY);
  const isJoinPath = /^\/join\/[^/?#]+$/.test(location.pathname);
  const cleanPath = isJoinPath ? "/" : location.pathname;
  const cleanQuery = query.toString();
  history.replaceState(null, "", `${cleanPath}${cleanQuery ? `?${cleanQuery}` : ""}`);
  return token;
}
