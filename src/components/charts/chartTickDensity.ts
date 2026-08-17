/**
 * Choose sparse chronological labels while retaining the selected bucket.
 * Interaction remains continuous; this controls visible axis text only.
 */
export function sparseTickIndices(
  count: number,
  selectedIndex: number,
  maximumTicks = 5,
): number[] {
  if (count <= maximumTicks) return Array.from({ length: count }, (_, index) => index);
  const minimumGap = Math.max(1, Math.floor(count / (maximumTicks + 1)));
  const candidates = [
    selectedIndex,
    0,
    count - 1,
    ...Array.from({ length: maximumTicks }, (_, index) =>
      Math.round((index * (count - 1)) / (maximumTicks - 1)),
    ),
  ];
  const chosen: number[] = [];
  for (const candidate of candidates) {
    if (
      !chosen.includes(candidate) &&
      chosen.every((existing) => Math.abs(existing - candidate) >= minimumGap)
    ) {
      chosen.push(candidate);
    }
    if (chosen.length === maximumTicks) break;
  }
  return chosen.sort((a, b) => a - b);
}
