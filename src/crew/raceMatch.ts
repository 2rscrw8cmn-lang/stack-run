import type { Race } from "../domain/types";

export interface CrewRace {
  raceName: string | null;
  raceDate: string | null;
  raceDistanceMiles: number | null;
}

export interface RaceMismatch {
  dateDiffers: boolean;
  distanceDiffers: boolean;
  mismatched: boolean;
}

/** A Run Club has no race to mismatch against, regardless of the viewer's local race. */
export function compareCrewRace(
  crew: CrewRace,
  localRace: Race | null,
): RaceMismatch {
  if (!localRace || crew.raceDate === null || crew.raceDistanceMiles === null) {
    return { dateDiffers: false, distanceDiffers: false, mismatched: false };
  }
  const dateDiffers = crew.raceDate !== localRace.date;
  const distanceDiffers =
    Math.abs(crew.raceDistanceMiles - localRace.distanceMiles) > 0.05;
  return {
    dateDiffers,
    distanceDiffers,
    mismatched: dateDiffers || distanceDiffers,
  };
}
