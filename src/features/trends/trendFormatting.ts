import { formatMiles } from "../../domain/distance";

export function paceLabel(secondsPerMile: number): string {
  const seconds = Math.round(secondsPerMile);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} /mi`;
}

export function signedMiles(value: number): string {
  if (value === 0) return "On plan";
  return `${value > 0 ? "+" : "−"}${formatMiles(Math.abs(value))} mi`;
}
