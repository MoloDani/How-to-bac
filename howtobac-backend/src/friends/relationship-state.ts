import { FriendshipStatus } from '../generated/prisma/enums.js';

/** How the current user relates to someone — tells the frontend which button to show. */
export const RelationshipState = {
  /** "Add friend" */
  NONE: 'NONE',
  /** "Cancel request" */
  REQUEST_SENT: 'REQUEST_SENT',
  /** "Accept / Decline" */
  REQUEST_RECEIVED: 'REQUEST_RECEIVED',
  /** "Unfriend" */
  FRIENDS: 'FRIENDS',
  /** "Unblock" — only ever shown to the person who blocked. */
  BLOCKED: 'BLOCKED',
} as const;
export type RelationshipState =
  (typeof RelationshipState)[keyof typeof RelationshipState];

export interface PairRow {
  requesterId: string;
  status: FriendshipStatus;
}

/**
 * The relationship as `meId` sees it. Being blocked by the other person is
 * deliberately invisible: it looks the same as having no relationship.
 */
export function relationshipState(
  meId: string,
  row: PairRow | null,
  iBlockedThem: boolean,
): RelationshipState {
  if (iBlockedThem) return RelationshipState.BLOCKED;
  if (!row) return RelationshipState.NONE;
  if (row.status === FriendshipStatus.ACCEPTED) {
    return RelationshipState.FRIENDS;
  }
  return row.requesterId === meId
    ? RelationshipState.REQUEST_SENT
    : RelationshipState.REQUEST_RECEIVED;
}
