import type { Prisma } from '../generated/prisma/client.js';
import type { Role, Subject } from '../generated/prisma/enums.js';

/** All other users ever see of someone (thread authors, friends, requests) — never their email. */
export const userSummarySelect = {
  id: true,
  userName: true,
  tag: true,
  role: true,
} satisfies Prisma.UserSelect;

export interface UserSummary {
  id: string;
  userName: string;
  /** Public handle, shown next to the name and used to add them as a friend. */
  tag: string;
  role: Role;
}

/** The user shape returned to that user (and admins). Never includes the password hash. */
export interface PublicUser {
  id: string;
  email: string;
  userName: string;
  tag: string;
  role: Role;
  subjects: Subject[];
  emailVerified: boolean;
  createdAt: Date;
}

export const publicUserSelect = {
  id: true,
  email: true,
  userName: true,
  tag: true,
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
  tag: row.tag,
  role: row.role,
  subjects: row.subjects.map((s) => s.subject),
  emailVerified: row.emailVerifiedAt !== null,
  createdAt: row.createdAt,
});
