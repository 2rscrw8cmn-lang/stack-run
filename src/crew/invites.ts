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
  return `${location.origin}${location.pathname}#${JOIN_FRAGMENT_KEY}=${encodeURIComponent(token)}`;
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

export function captureInviteFromLocation(location: Location = window.location): string | null {
  const token = inviteTokenFromHash(location.hash);
  if (!token) return loadPendingInvite();
  rememberPendingInvite(token);
  history.replaceState(null, "", `${location.pathname}${location.search}`);
  return token;
}
