import { z } from 'zod';

export const idParamSchema = z.uuid();

export const threadTitleSchema = z.string().trim().min(1).max(120);
export const messageContentSchema = z.string().trim().min(1).max(4000);
const limitSchema = z.coerce.number().int().min(1).max(100);

export const listThreadsQuerySchema = z.object({
  cursor: z.uuid().optional(),
  limit: limitSchema.default(20),
});
export type ListThreadsQuery = z.output<typeof listThreadsQuerySchema>;

export const createThreadSchema = z.object({
  title: threadTitleSchema,
  content: messageContentSchema,
});
export type CreateThreadDto = z.output<typeof createThreadSchema>;

export const updateThreadSchema = z.object({ title: threadTitleSchema });
export type UpdateThreadDto = z.output<typeof updateThreadSchema>;

export const moderateThreadSchema = z
  .object({
    pinned: z.boolean().optional(),
    locked: z.boolean().optional(),
  })
  .refine((dto) => dto.pinned !== undefined || dto.locked !== undefined, {
    message: 'set pinned and/or locked',
  });
export type ModerateThreadDto = z.output<typeof moderateThreadSchema>;

export const listMessagesQuerySchema = z.object({
  /** Id of the last message already seen; returns the ones after it. */
  after: z.uuid().optional(),
  limit: limitSchema.default(50),
});
export type ListMessagesQuery = z.output<typeof listMessagesQuerySchema>;

export const createMessageSchema = z.object({
  content: messageContentSchema,
  replyToId: z.uuid().optional(),
});
export type CreateMessageDto = z.output<typeof createMessageSchema>;

export const updateMessageSchema = z.object({ content: messageContentSchema });
export type UpdateMessageDto = z.output<typeof updateMessageSchema>;
