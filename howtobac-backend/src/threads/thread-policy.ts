import { canAccessSubject } from '../auth/access-policy.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { Subject } from '../generated/prisma/enums.js';

export type Viewer = Pick<AuthUser, 'id' | 'role' | 'subjects'>;

export interface ThreadRef {
  subject: Subject;
  authorId: string | null;
  locked: boolean;
}

interface Authored {
  authorId: string | null;
}

const isAuthor = (user: Viewer, item: Authored) =>
  item.authorId !== null && item.authorId === user.id;

/** Reading a subject's threads follows the same rule as viewing the subject. */
export const canReadThreads = (user: Viewer, subject: Subject) =>
  canAccessSubject(user, 'view', subject);

/** Pin, lock and delete anything: whoever may edit the subject. */
export const canModerate = (user: Viewer, subject: Subject) =>
  canAccessSubject(user, 'edit', subject);

/** Locked threads only take messages from moderators. */
export const canPostIn = (user: Viewer, thread: ThreadRef) =>
  canReadThreads(user, thread.subject) &&
  (!thread.locked || canModerate(user, thread.subject));

/** Rename or delete a thread (deleting hides everyone's replies with it). */
export const canEditThread = (user: Viewer, thread: ThreadRef) =>
  canReadThreads(user, thread.subject) &&
  (isAuthor(user, thread) || canModerate(user, thread.subject));

export const canDeleteThread = canEditThread;

export const canEditMessage = (
  user: Viewer,
  thread: ThreadRef,
  message: Authored,
) => canReadThreads(user, thread.subject) && isAuthor(user, message);

export const canDeleteMessage = (
  user: Viewer,
  thread: ThreadRef,
  message: Authored,
) =>
  canReadThreads(user, thread.subject) &&
  (isAuthor(user, message) || canModerate(user, thread.subject));
