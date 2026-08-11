import type { Race } from "../domain/types";

export interface CrewRace {
  raceName: string;
  raceDate: string;
  raceDistanceMiles: number;
}

export interface RaceMismatch {
  dateDiffers: boolean;
  distanceDiffers: boolean;
  mismatched: boolean;
}

export function compareCrewRace(
  crew: CrewRace,
  localRace: Race | null,
): RaceMismatch {
  if (!localRace) {
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
