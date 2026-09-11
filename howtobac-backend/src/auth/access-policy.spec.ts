import { Role, Subject } from '../generated/prisma/enums.js';
import { canAccessSubject, type SubjectAction } from './access-policy.js';

const assigned = Subject.PHYSICS;
const other = Subject.MATHEMATICS;
const subjects = [assigned];

describe('canAccessSubject', () => {
  const cases: [Role, SubjectAction, Subject, boolean][] = [
    [Role.ADMIN, 'view', assigned, true],
    [Role.ADMIN, 'edit', assigned, true],
    [Role.ADMIN, 'view', other, true],
    [Role.ADMIN, 'edit', other, true],
    [Role.CONTRIBUTOR, 'view', assigned, true],
    [Role.CONTRIBUTOR, 'edit', assigned, true],
    [Role.CONTRIBUTOR, 'view', other, false],
    [Role.CONTRIBUTOR, 'edit', other, false],
    [Role.USER, 'view', assigned, true],
    [Role.USER, 'edit', assigned, false],
    [Role.USER, 'view', other, false],
    [Role.USER, 'edit', other, false],
  ];

  it.each(cases)('%s %s %s -> %s', (role, action, subject, expected) => {
    expect(canAccessSubject({ role, subjects }, action, subject)).toBe(
      expected,
    );
  });

  it('ignores the subject list for admins', () => {
    expect(
      canAccessSubject({ role: Role.ADMIN, subjects: [] }, 'edit', other),
    ).toBe(true);
  });
});
