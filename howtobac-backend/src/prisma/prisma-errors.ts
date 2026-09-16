import { Prisma } from '../generated/prisma/client.js';

/** True when a write hit a unique constraint (e.g. two sign-ups racing on one email). */
export const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

/**
 * Narrows a unique violation to one column, so a sign-up can tell "that tag is
 * taken" from "that email is taken". Depending on the driver, Prisma reports
 * either the field names or the constraint name (`users_tag_key`).
 */
export const isUniqueViolationOn = (err: unknown, field: string) => {
  if (!isUniqueViolation(err)) return false;
  const target = (err as Prisma.PrismaClientKnownRequestError).meta?.target;
  const targets = Array.isArray(target) ? target : [target];
  return targets.some(
    (entry) => typeof entry === 'string' && entry.includes(field),
  );
};
