import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidStackPin } from "./auth.js";
import { STACK_PIN_RESET_URL } from "./authRoutes.js";

export async function requestStackPinReset(
  client: SupabaseClient,
  emailInput: string,
  redirectTo = STACK_PIN_RESET_URL,
): Promise<void> {
  const email = emailInput.trim();
  if (!email) throw new Error("Enter your email.");

  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw new Error(error.message);
}

export async function updateStackPin(
  client: SupabaseClient,
  pin: string,
): Promise<void> {
  if (!isValidStackPin(pin)) {
    throw new Error("STACK PIN must be exactly 8 numbers.");
  }

  const { error } = await client.auth.updateUser({ password: pin });
  if (error) throw new Error(error.message);
}
