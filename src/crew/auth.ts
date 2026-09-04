import type { SupabaseClient, User } from "@supabase/supabase-js";
import { STACK_PIN_FORGOT_URL } from "./authRoutes.js";

export const STACK_PIN_PATTERN = /^\d{8}$/;

export function isValidStackPin(pin: string): boolean {
  return STACK_PIN_PATTERN.test(pin);
}

export async function createStackAccount(
  client: SupabaseClient,
  input: { email: string; pin: string; displayName: string },
): Promise<User> {
  const email = input.email.trim();
  const displayName = input.displayName.trim();
  if (!email || !displayName) throw new Error("Enter your name and email.");
  if (!isValidStackPin(input.pin)) {
    throw new Error("STACK PIN must be exactly 8 numbers.");
  }
  const { data, error } = await client.auth.signUp({
    email,
    password: input.pin,
    options: { data: { display_name: displayName } },
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("STACK account could not be created.");
  if (!data.session) {
    throw new Error(
      "Account created, but sign-in is waiting for email confirmation. Disable Confirm email for this hobby release, then try again.",
    );
  }
  return data.user;
}

export async function signInToStack(
  client: SupabaseClient,
  input: { email: string; pin: string },
): Promise<User> {
  const email = input.email.trim();
  if (!email) throw new Error("Enter your email.");
  if (!isValidStackPin(input.pin)) {
    throw new Error("STACK PIN must be exactly 8 numbers.");
  }
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: input.pin,
  });
  if (error) {
    if (/invalid login credentials/i.test(error.message)) {
      throw new Error(
        `Email or STACK PIN is incorrect. Forgot your PIN? Reset it at ${STACK_PIN_FORGOT_URL}`,
      );
    }
    throw new Error(error.message);
  }
  if (!data.user) throw new Error("STACK could not sign in.");
  return data.user;
}

export async function signOutOfStack(client: SupabaseClient): Promise<void> {
  const { error } = await client.auth.signOut();
  if (error) throw new Error(error.message);
}
