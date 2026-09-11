import { Subject } from '../generated/prisma/enums.js';
import {
  MAX_USER_SUBJECTS,
  subjectListSchema,
  userSubjectListSchema,
} from './subjects.js';

const all = Object.values(Subject);

describe('subject list schemas', () => {
  it('removes duplicates', () => {
    expect(
      subjectListSchema.parse([Subject.LOGIC, Subject.LOGIC, Subject.HISTORY]),
    ).toEqual([Subject.LOGIC, Subject.HISTORY]);
  });

  it('rejects unknown subjects', () => {
    expect(subjectListSchema.safeParse(['ASTROLOGY']).success).toBe(false);
  });

  it(`lets users pick up to ${MAX_USER_SUBJECTS}`, () => {
    expect(
      userSubjectListSchema.safeParse(all.slice(0, MAX_USER_SUBJECTS)).success,
    ).toBe(true);
    expect(
      userSubjectListSchema.safeParse(all.slice(0, MAX_USER_SUBJECTS + 1))
        .success,
    ).toBe(false);
  });

  it('counts duplicates once toward the limit', () => {
    const picks = all.slice(0, MAX_USER_SUBJECTS);
    expect(userSubjectListSchema.safeParse([...picks, picks[0]]).success).toBe(
      true,
    );
  });

  it('has no limit for admin-assigned lists', () => {
    expect(subjectListSchema.safeParse(all).success).toBe(true);
  });
});
