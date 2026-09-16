import { SUBJECTS } from '#/lib/subjects'
import type { Message, PublicUser, Thread } from '#/lib/api/types'
import type { Subject } from '#/lib/subjects'

/**
 * Mirrors the backend's rules (src/auth/access-policy.ts and
 * src/threads/thread-policy.ts) so the UI only offers what the API allows.
 * The API remains the thing that enforces them.
 */
type Viewer = Pick<PublicUser, 'id' | 'role' | 'subjects'>

/** Admins see every subject; everyone else sees the ones they hold. */
export const visibleSubjects = (user: Viewer): Array<Subject> =>
  user.role === 'ADMIN' ? [...SUBJECTS] : user.subjects

export const canOpenSubject = (user: Viewer, subject: Subject) =>
  user.role === 'ADMIN' || user.subjects.includes(subject)

/** Pin, lock, and delete anyone's content: admins and the subject's contributors. */
export const canModerate = (user: Viewer, subject: Subject) =>
  user.role === 'ADMIN' ||
  (user.role === 'CONTRIBUTOR' && user.subjects.includes(subject))

const isAuthor = (user: Viewer, item: { author: { id: string } | null }) =>
  item.author !== null && item.author.id === user.id

/** Locked threads only take messages from moderators. */
export const canPost = (user: Viewer, thread: Thread) =>
  !thread.locked || canModerate(user, thread.subject)

export const canEditMessage = (user: Viewer, message: Message) =>
  !message.deleted && isAuthor(user, message)

export const canDeleteMessage = (
  user: Viewer,
  subject: Subject,
  message: Message,
) => !message.deleted && (isAuthor(user, message) || canModerate(user, subject))

/** Rename or delete a thread: its author, or a moderator. */
export const canEditThread = (user: Viewer, thread: Thread) =>
  isAuthor(user, thread) || canModerate(user, thread.subject)
