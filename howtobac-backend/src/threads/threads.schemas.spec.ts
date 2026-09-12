import {
  createMessageSchema,
  createThreadSchema,
  listMessagesQuerySchema,
  moderateThreadSchema,
} from './threads.schemas.js';

describe('thread schemas', () => {
  it('trims titles and content', () => {
    expect(
      createThreadSchema.parse({ title: '  Derivatives  ', content: ' Why? ' }),
    ).toEqual({ title: 'Derivatives', content: 'Why?' });
  });

  it('rejects blank or oversized titles', () => {
    expect(
      createThreadSchema.safeParse({ title: '   ', content: 'x' }).success,
    ).toBe(false);
    expect(
      createThreadSchema.safeParse({ title: 'a'.repeat(121), content: 'x' })
        .success,
    ).toBe(false);
    expect(
      createThreadSchema.safeParse({ title: 'a'.repeat(120), content: 'x' })
        .success,
    ).toBe(true);
  });

  it('caps message content at 4000 characters', () => {
    expect(
      createMessageSchema.safeParse({ content: 'a'.repeat(4000) }).success,
    ).toBe(true);
    expect(
      createMessageSchema.safeParse({ content: 'a'.repeat(4001) }).success,
    ).toBe(false);
  });

  it('requires replyToId to be a uuid', () => {
    expect(
      createMessageSchema.safeParse({ content: 'hi', replyToId: 'nope' })
        .success,
    ).toBe(false);
  });

  it('needs at least one moderation field', () => {
    expect(moderateThreadSchema.safeParse({}).success).toBe(false);
    expect(moderateThreadSchema.safeParse({ locked: true }).success).toBe(true);
  });

  it('coerces and bounds the page size', () => {
    expect(listMessagesQuerySchema.parse({ limit: '10' }).limit).toBe(10);
    expect(listMessagesQuerySchema.parse({}).limit).toBe(50);
    expect(listMessagesQuerySchema.safeParse({ limit: '101' }).success).toBe(
      false,
    );
  });
});
