import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingInvite,
  createInviteToken,
  hashInviteToken,
  inviteTokenFromLocation,
  inviteTokenFromHash,
  loadPendingInvite,
  rememberPendingInvite,
} from "./invites.js";

describe("crew invites", () => {
  beforeEach(() => sessionStorage.clear());

  it("creates high-entropy URL-safe tokens and hashes them deterministically", async () => {
    vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
      const bytes = array as Uint8Array;
      bytes.forEach((_, index) => { bytes[index] = index; });
      return array;
    });
    const token = createInviteToken();
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await hashInviteToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(await hashInviteToken(token)).toBe(await hashInviteToken(token));
  });

  it("reads only the join fragment and retains it for the sign-in handoff", () => {
    expect(inviteTokenFromHash("#join=private_token&other=value")).toBe(
      "private_token",
    );
    expect(inviteTokenFromHash("#other=value")).toBeNull();
    rememberPendingInvite("private_token");
    expect(loadPendingInvite()).toBe("private_token");
    clearPendingInvite();
    expect(loadPendingInvite()).toBeNull();
  });

  it("accepts server-rendered join paths and the post-preview query handoff", () => {
    expect(inviteTokenFromLocation({ pathname: "/join/private_token", search: "", hash: "" } as Location)).toBe("private_token");
    expect(inviteTokenFromLocation({ pathname: "/", search: "?join=private_token", hash: "" } as Location)).toBe("private_token");
  });
});
