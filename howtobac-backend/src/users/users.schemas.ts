import { z } from 'zod';
import {
  emailSchema,
  passwordSchema,
  userNameSchema,
} from '../auth/auth.schemas.js';
import {
  subjectListSchema,
  userSubjectListSchema,
} from '../common/subjects.js';
import { Role } from '../generated/prisma/enums.js';
import { tagSchema } from './user-tag.js';

/** Both fields are optional, but sending neither is a mistake worth reporting. */
export const updateMeSchema = z
  .object({
    userName: userNameSchema.optional(),
    tag: tagSchema.optional(),
  })
  .refine(
    (dto) => dto.userName !== undefined || dto.tag !== undefined,
    'nothing_to_update',
  );
export type UpdateMeDto = z.output<typeof updateMeSchema>;

export const setMySubjectsSchema = z.object({
  subjects: userSubjectListSchema,
});
export type SetMySubjectsDto = z.output<typeof setMySubjectsSchema>;

/** Anything that could lock someone out asks for the password again. */
const currentPasswordSchema = z.string().min(1).max(200);

export const changePasswordSchema = z.object({
  currentPassword: currentPasswordSchema,
  newPassword: passwordSchema,
});
export type ChangePasswordDto = z.output<typeof changePasswordSchema>;

export const changeEmailSchema = z.object({
  currentPassword: currentPasswordSchema,
  newEmail: emailSchema,
});
export type ChangeEmailDto = z.output<typeof changeEmailSchema>;

export const confirmPasswordSchema = z.object({
  currentPassword: currentPasswordSchema,
});
export type ConfirmPasswordDto = z.output<typeof confirmPasswordSchema>;

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
