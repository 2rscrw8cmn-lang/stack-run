import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  createStackAccount,
  isValidStackPin,
  signInToStack,
  signOutOfStack,
  STACK_PIN_PATTERN,
} from "./auth.js";

describe("STACK PIN", () => {
  it.each(["00000000", "12345678", "99999999"])("accepts %s", (pin) => {
    expect(isValidStackPin(pin)).toBe(true);
    expect(STACK_PIN_PATTERN.test(pin)).toBe(true);
  });

  it.each(["1234567", "123456789", "1234 678", "abcdefgh", "１２３４５６７８", ""])(
    "rejects %s",
    (pin) => expect(isValidStackPin(pin)).toBe(false),
  );
});

describe("STACK account auth", () => {
  const user = { id: "fake-user" };

  it("uses normal password auth without persisting or transforming the PIN", async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: { user, session: { access_token: "fake-session" } },
      error: null,
    });
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user },
      error: null,
    });
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const client = {
      auth: { signUp, signInWithPassword, signOut },
    } as unknown as SupabaseClient;

    await createStackAccount(client, {
      email: " runner@example.test ",
      pin: "12345678",
      displayName: " Runner ",
    });
    await signInToStack(client, {
      email: " runner@example.test ",
      pin: "12345678",
    });
    await signOutOfStack(client);

    expect(signUp).toHaveBeenCalledWith({
      email: "runner@example.test",
      password: "12345678",
      options: { data: { display_name: "Runner" } },
    });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "runner@example.test",
      password: "12345678",
    });
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("points invalid credentials to the STACK PIN recovery page", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });
    const client = { auth: { signInWithPassword } } as unknown as SupabaseClient;

    await expect(
      signInToStack(client, { email: "runner@example.test", pin: "12345678" }),
    ).rejects.toThrow("https://stack-run.vercel.app/forgot-pin");
  });
});
