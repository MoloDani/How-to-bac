import { z } from 'zod';
import { tagSchema } from '../users/user-tag.js';

/** Lowercased so a self-check like `userId === user.id` can't be dodged with uppercase. */
export const userIdParamSchema = z.uuid().transform((id) => id.toLowerCase());

export const sendRequestSchema = z.object({ tag: tagSchema });
export type SendRequestDto = z.output<typeof sendRequestSchema>;

export const listQuerySchema = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListQuery = z.output<typeof listQuerySchema>;
