import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { requestStackPinReset, updateStackPin } from "./pinRecovery.js";

describe("STACK PIN recovery", () => {
  it("requests a recovery email with the requested redirect URL", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ data: {}, error: null });
    const client = { auth: { resetPasswordForEmail } } as unknown as SupabaseClient;

    await requestStackPinReset(
      client,
      " runner@example.test ",
      "https://stack.example/reset-pin",
    );

    expect(resetPasswordForEmail).toHaveBeenCalledWith("runner@example.test", {
      redirectTo: "https://stack.example/reset-pin",
    });
  });

  it("updates the authenticated account with a new 8-digit PIN", async () => {
    const updateUser = vi.fn().mockResolvedValue({ data: {}, error: null });
    const client = { auth: { updateUser } } as unknown as SupabaseClient;

    await updateStackPin(client, "87654321");

    expect(updateUser).toHaveBeenCalledWith({ password: "87654321" });
  });

  it("rejects invalid PINs before calling Supabase", async () => {
    const updateUser = vi.fn();
    const client = { auth: { updateUser } } as unknown as SupabaseClient;

    await expect(updateStackPin(client, "1234")).rejects.toThrow(
      "STACK PIN must be exactly 8 numbers.",
    );
    expect(updateUser).not.toHaveBeenCalled();
  });
});
