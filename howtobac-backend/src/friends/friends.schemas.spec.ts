import {
  listQuerySchema,
  sendRequestSchema,
  userIdParamSchema,
} from './friends.schemas.js';

describe('friends schemas', () => {
  it('normalizes the tag in a request', () => {
    expect(sendRequestSchema.parse({ tag: ' @Andrei_M ' })).toEqual({
      tag: 'andrei_m',
    });
    expect(sendRequestSchema.safeParse({ tag: 'no' }).success).toBe(false);
  });

  it('lowercases user ids', () => {
    expect(
      userIdParamSchema.parse('01A090C2-6791-7307-A2D4-14B805989E4C'),
    ).toBe('01a090c2-6791-7307-a2d4-14b805989e4c');
    expect(userIdParamSchema.safeParse('not-a-uuid').success).toBe(false);
  });

  it('defaults and bounds the page size', () => {
    expect(listQuerySchema.parse({}).limit).toBe(50);
    expect(listQuerySchema.parse({ limit: '5' }).limit).toBe(5);
    expect(listQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
  });
});
