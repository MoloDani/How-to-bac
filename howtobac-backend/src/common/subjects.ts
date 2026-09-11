import { z } from 'zod';
import { Subject } from '../generated/prisma/enums.js';

/** How many subjects a regular user may pick for themselves. */
export const MAX_USER_SUBJECTS = 3;

export const subjectSchema = z.enum(Subject);

/** Any number of subjects, duplicates removed. Used by admins. */
export const subjectListSchema = z
  .array(subjectSchema)
  .transform((subjects) => [...new Set(subjects)]);

/** Subjects a user picks for themselves, capped at MAX_USER_SUBJECTS. */
export const userSubjectListSchema = subjectListSchema.pipe(
  z
    .array(subjectSchema)
    .max(
      MAX_USER_SUBJECTS,
      `you can pick at most ${MAX_USER_SUBJECTS} subjects`,
    ),
);
