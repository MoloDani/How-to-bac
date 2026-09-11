import { Role, type Subject } from '../generated/prisma/enums.js';
import type { AuthUser } from './auth.types.js';

export type SubjectAction = 'view' | 'edit';

/**
 * ADMIN       -> every subject
 * CONTRIBUTOR -> view + edit on assigned subjects
 * USER        -> view on picked subjects
 */
export function canAccessSubject(
  user: Pick<AuthUser, 'role' | 'subjects'>,
  action: SubjectAction,
  subject: Subject,
): boolean {
  switch (user.role) {
    case Role.ADMIN:
      return true;
    case Role.CONTRIBUTOR:
      return user.subjects.includes(subject);
    case Role.USER:
      return action === 'view' && user.subjects.includes(subject);
  }
}
