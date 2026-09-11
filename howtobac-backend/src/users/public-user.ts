import type { Prisma } from '../generated/prisma/client.js';
import type { Role, Subject } from '../generated/prisma/enums.js';

/** The user shape returned by the API. Never includes the password hash. */
export interface PublicUser {
  id: string;
  email: string;
  userName: string;
  role: Role;
  subjects: Subject[];
  emailVerified: boolean;
  createdAt: Date;
}

export const publicUserSelect = {
  id: true,
  email: true,
  userName: true,
  role: true,
  emailVerifiedAt: true,
  createdAt: true,
  subjects: { select: { subject: true }, orderBy: { subject: 'asc' } },
} satisfies Prisma.UserSelect;

type PublicUserRow = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

export const toPublicUser = (row: PublicUserRow): PublicUser => ({
  id: row.id,
  email: row.email,
  userName: row.userName,
  role: row.role,
  subjects: row.subjects.map((s) => s.subject),
  emailVerified: row.emailVerifiedAt !== null,
  createdAt: row.createdAt,
});
