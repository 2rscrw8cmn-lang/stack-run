export interface CrewProfile {
  id: string;
  displayName: string;
}

export interface RaceCrew {
  id: string;
  ownerUserId: string;
  name: string;
  raceName: string;
  raceDate: string;
  raceDistanceMiles: number;
}

export type CrewRole = "owner" | "member";

export interface CrewMember {
  userId: string;
  role: CrewRole;
  joinedAt: string;
  displayName: string;
}

export interface CrewInvite {
  id: string;
  expiresAt: string;
  revokedAt: string | null;
  redeemedAt: string | null;
}

export interface CrewInvitePreview {
  crewId: string;
  crewName: string;
  raceName: string;
  raceDate: string;
  raceDistanceMiles: number;
  expiresAt: string;
}

export interface LoadedCrewAccount {
  profile: CrewProfile;
  crew: RaceCrew | null;
  role: CrewRole | null;
  members: CrewMember[];
  invites: CrewInvite[];
}
