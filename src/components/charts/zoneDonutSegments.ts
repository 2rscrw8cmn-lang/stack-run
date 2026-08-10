import { formatDurationSeconds } from "../../domain/duration";
import type { DonutSegment } from "./DonutChart";

export function zoneDonutSegments(zoneSeconds: readonly number[]): DonutSegment[] {
  const colors = [
    "var(--zone-1)",
    "var(--zone-2)",
    "var(--zone-3)",
    "var(--zone-4)",
    "var(--zone-5)",
    "var(--zone-6)",
    "var(--zone-7)",
  ];
  return zoneSeconds.map((seconds, index) => ({
    label: `Zone ${index + 1}`,
    value: seconds,
    valueLabel: formatDurationSeconds(seconds),
    color: colors[index % colors.length],
  }));
}
