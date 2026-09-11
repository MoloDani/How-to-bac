import { z } from 'zod';
import { userNameSchema } from '../auth/auth.schemas.js';
import {
  subjectListSchema,
  userSubjectListSchema,
} from '../common/subjects.js';
import { Role } from '../generated/prisma/enums.js';

export const updateMeSchema = z.object({ userName: userNameSchema });
export type UpdateMeDto = z.output<typeof updateMeSchema>;

export const setMySubjectsSchema = z.object({
  subjects: userSubjectListSchema,
});
export type SetMySubjectsDto = z.output<typeof setMySubjectsSchema>;

export const setSubjectsSchema = z.object({ subjects: subjectListSchema });
export type SetSubjectsDto = z.output<typeof setSubjectsSchema>;

export const setRoleSchema = z.object({ role: z.enum(Role) });
export type SetRoleDto = z.output<typeof setRoleSchema>;

export const listUsersQuerySchema = z.object({
  role: z.enum(Role).optional(),
  q: z.string().trim().min(1).max(255).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListUsersQuery = z.output<typeof listUsersQuerySchema>;
