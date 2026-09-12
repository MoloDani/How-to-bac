import { FriendshipStatus } from '../generated/prisma/enums.js';
import {
  RelationshipState,
  relationshipState,
  type PairRow,
} from './relationship-state.js';

const ME = 'me';
const THEM = 'them';

const rows: [string, PairRow | null][] = [
  ['no row', null],
  [
    'pending, sent by me',
    { requesterId: ME, status: FriendshipStatus.PENDING },
  ],
  [
    'pending, sent by them',
    { requesterId: THEM, status: FriendshipStatus.PENDING },
  ],
  [
    'accepted (I asked)',
    { requesterId: ME, status: FriendshipStatus.ACCEPTED },
  ],
  [
    'accepted (they asked)',
    { requesterId: THEM, status: FriendshipStatus.ACCEPTED },
  ],
];

const expectedWithoutBlock = [
  RelationshipState.NONE,
  RelationshipState.REQUEST_SENT,
  RelationshipState.REQUEST_RECEIVED,
  RelationshipState.FRIENDS,
  RelationshipState.FRIENDS,
];

describe('relationshipState', () => {
  it.each(rows.map(([label, row], i) => [label, row, expectedWithoutBlock[i]]))(
    '%s -> %s',
    (_, row, expected) => {
      expect(relationshipState(ME, row as PairRow | null, false)).toBe(
        expected,
      );
    },
  );

  it.each(rows)('%s, and I blocked them -> BLOCKED', (_, row) => {
    expect(relationshipState(ME, row, true)).toBe(RelationshipState.BLOCKED);
  });

  it('a block by them looks like no relationship', () => {
    // The caller only passes "I blocked them"; their block never reaches here.
    expect(relationshipState(ME, null, false)).toBe(RelationshipState.NONE);
  });
});
