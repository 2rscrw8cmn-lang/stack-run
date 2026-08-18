import type { CrewMember } from "./types";

/** Current runner first, then the stable membership order from joined_at. */
export function viewerFirstMembers(
  members: readonly CrewMember[],
  currentUserId: string | undefined,
): CrewMember[] {
  if (!currentUserId) return [...members];
  return [
    ...members.filter((member) => member.userId === currentUserId),
    ...members.filter((member) => member.userId !== currentUserId),
  ];
}
