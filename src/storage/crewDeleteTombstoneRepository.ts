import { CREW_DELETE_TOMBSTONES_STORAGE_KEY } from "./storageKeys.js";

export interface CrewDeleteTombstone {
  crewId: string;
  userId: string;
  localRunId: string;
  deletedAt: string;
}

function isTombstone(value: unknown): value is CrewDeleteTombstone {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CrewDeleteTombstone>;
  return (
    typeof candidate.crewId === "string" &&
    candidate.crewId.length > 0 &&
    typeof candidate.userId === "string" &&
    candidate.userId.length > 0 &&
    typeof candidate.localRunId === "string" &&
    candidate.localRunId.length > 0 &&
    typeof candidate.deletedAt === "string"
  );
}

function keyOf(tombstone: Pick<CrewDeleteTombstone, "crewId" | "userId" | "localRunId">): string {
  return `${tombstone.crewId}\u0000${tombstone.userId}\u0000${tombstone.localRunId}`;
}

export function loadCrewDeleteTombstones(): CrewDeleteTombstone[] {
  const raw = localStorage.getItem(CREW_DELETE_TOMBSTONES_STORAGE_KEY);
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed.filter(isTombstone) : [];
}

function saveCrewDeleteTombstones(tombstones: readonly CrewDeleteTombstone[]): void {
  if (tombstones.length === 0) {
    localStorage.removeItem(CREW_DELETE_TOMBSTONES_STORAGE_KEY);
    return;
  }
  localStorage.setItem(
    CREW_DELETE_TOMBSTONES_STORAGE_KEY,
    JSON.stringify(tombstones),
  );
}

/** Only an explicit personal run deletion may call this writer. */
export function addCrewDeleteTombstone(
  tombstone: CrewDeleteTombstone,
): void {
  const existing = loadCrewDeleteTombstones();
  const key = keyOf(tombstone);
  saveCrewDeleteTombstones([
    ...existing.filter((item) => keyOf(item) !== key),
    tombstone,
  ]);
}

export function removeCrewDeleteTombstone(
  tombstone: Pick<CrewDeleteTombstone, "crewId" | "userId" | "localRunId">,
): void {
  const key = keyOf(tombstone);
  saveCrewDeleteTombstones(
    loadCrewDeleteTombstones().filter((item) => keyOf(item) !== key),
  );
}
