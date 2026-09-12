import type { Prisma } from '../generated/prisma/client.js';
import type { Role, Subject } from '../generated/prisma/enums.js';

/** All other users ever see of someone (thread authors, friends, requests) — never their email. */
export const userSummarySelect = {
  id: true,
  userName: true,
  role: true,
} satisfies Prisma.UserSelect;

export interface UserSummary {
  id: string;
  userName: string;
  role: Role;
}

/** The user shape returned to that user (and admins). Never includes the password hash. */
export interface PublicUser {
  id: string;
  email: string;
  userName: string;
  role: Role;
  subjects: Subject[];
  friendCode: string;
  emailVerified: boolean;
  createdAt: Date;
}

export const publicUserSelect = {
  id: true,
  email: true,
  userName: true,
  role: true,
  friendCode: true,
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
  friendCode: row.friendCode,
  emailVerified: row.emailVerifiedAt !== null,
  createdAt: row.createdAt,
});
