import { getSupabaseAvailability } from "./supabaseClient";

export type CrewAwardQaAction = "seed" | "clear";

async function runQaAction(action: CrewAwardQaAction): Promise<number> {
  const availability = getSupabaseAvailability();
  if (!availability.configured) throw new Error("Crew QA requires Supabase.");

  const functionName = action === "seed"
    ? "qa_seed_crew_award_fixture"
    : "qa_clear_crew_award_fixture";
  const result = await availability.client.rpc(functionName);
  if (result.error) throw new Error(result.error.message);

  const count = typeof result.data === "number" ? result.data : Number(result.data);
  return Number.isFinite(count) ? count : 0;
}

/**
 * Hidden preview-only QA controls. The matching RPCs refuse every Crew except
 * an owner-operated Crew named exactly TEST CLUB, so this can never seed a
 * normal Crew by accident.
 */
export function seedCrewAwardQaFixture(): Promise<number> {
  return runQaAction("seed");
}

export function clearCrewAwardQaFixture(): Promise<number> {
  return runQaAction("clear");
}
