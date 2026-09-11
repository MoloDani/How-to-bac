import { Prisma } from '../generated/prisma/client.js';

/** True when a write hit a unique constraint (e.g. two sign-ups racing on one email). */
export const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
