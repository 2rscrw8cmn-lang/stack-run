import { formatMiles } from "../../domain/distance.js";
import { formatPaceSeconds } from "../../domain/runs.js";

export function paceLabel(secondsPerMile: number): string {
  return formatPaceSeconds(secondsPerMile);
}

export function signedMiles(value: number): string {
  if (value === 0) return "On plan";
  return `${value > 0 ? "+" : "−"}${formatMiles(Math.abs(value))} mi`;
}
