import {
  FRIEND_CODE_ALPHABET,
  friendCodeSchema,
  generateFriendCode,
} from './friend-code.js';

describe('friend codes', () => {
  it('generates 8 characters from the unambiguous alphabet', () => {
    expect(FRIEND_CODE_ALPHABET).toHaveLength(31);
    for (let i = 0; i < 500; i++) {
      expect(generateFriendCode()).toMatch(
        /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/,
      );
    }
  });

  it('normalizes what people type', () => {
    expect(friendCodeSchema.parse('k7mq-2xpa')).toBe('K7MQ2XPA');
    expect(friendCodeSchema.parse(' K7MQ 2XPA ')).toBe('K7MQ2XPA');
  });

  it.each(['K7MQ2XP0', 'K7MQ2XPI', 'K7MQ2XP', 'K7MQ2XPAA', 'K7MQ_2XPA', ''])(
    'rejects %j',
    (input) => {
      expect(friendCodeSchema.safeParse(input).success).toBe(false);
    },
  );
});
