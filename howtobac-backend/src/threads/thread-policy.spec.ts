import { Role, Subject } from '../generated/prisma/enums.js';
import {
  canDeleteMessage,
  canDeleteThread,
  canEditMessage,
  canEditThread,
  canModerate,
  canPostIn,
  canReadThreads,
  type ThreadRef,
  type Viewer,
} from './thread-policy.js';

const MATH = Subject.MATHEMATICS;
const viewer = (id: string, role: Role, subjects: Subject[] = []): Viewer => ({
  id,
  role,
  subjects,
});

const author = viewer('author', Role.USER, [MATH]);
const reader = viewer('reader', Role.USER, [MATH]);
const outsider = viewer('outsider', Role.USER, [Subject.PHYSICS]);
const mathContributor = viewer('math-contributor', Role.CONTRIBUTOR, [MATH]);
const physicsContributor = viewer('physics-contributor', Role.CONTRIBUTOR, [
  Subject.PHYSICS,
]);
const admin = viewer('admin', Role.ADMIN);

const open: ThreadRef = { subject: MATH, authorId: author.id, locked: false };
const locked: ThreadRef = { ...open, locked: true };
const byAuthor = { authorId: author.id };

describe('thread policy', () => {
  it.each([
    ['author', author, true, false],
    ['reader', reader, true, false],
    ['outsider', outsider, false, false],
    ['math contributor', mathContributor, true, true],
    ['physics contributor', physicsContributor, false, false],
    ['admin', admin, true, true],
  ])('%s: read=%s, moderate=%s', (_, user, read, moderate) => {
    expect(canReadThreads(user, MATH)).toBe(read);
    expect(canModerate(user, MATH)).toBe(moderate);
  });

  it.each([
    ['author', author, true, false],
    ['reader', reader, true, false],
    ['outsider', outsider, false, false],
    ['math contributor', mathContributor, true, true],
    ['physics contributor', physicsContributor, false, false],
    ['admin', admin, true, true],
  ])('%s posts: open=%s, locked=%s', (_, user, inOpen, inLocked) => {
    expect(canPostIn(user, open)).toBe(inOpen);
    expect(canPostIn(user, locked)).toBe(inLocked);
  });

  it.each([
    ['author', author, true],
    ['reader', reader, false],
    ['outsider', outsider, false],
    ['math contributor', mathContributor, true],
    ['physics contributor', physicsContributor, false],
    ['admin', admin, true],
  ])('%s renames/deletes the thread: %s', (_, user, allowed) => {
    expect(canEditThread(user, open)).toBe(allowed);
    expect(canDeleteThread(user, open)).toBe(allowed);
  });

  it.each([
    ['author', author, true, true],
    ['reader', reader, false, false],
    ['outsider', outsider, false, false],
    ['math contributor', mathContributor, false, true],
    ['physics contributor', physicsContributor, false, false],
    ['admin', admin, false, true],
  ])("%s on the author's message: edit=%s, delete=%s", (_, user, edit, del) => {
    expect(canEditMessage(user, open, byAuthor)).toBe(edit);
    expect(canDeleteMessage(user, open, byAuthor)).toBe(del);
  });

  it('an author who lost access to the subject can no longer edit or delete', () => {
    const formerMember = viewer(author.id, Role.USER, []);
    expect(canEditThread(formerMember, open)).toBe(false);
    expect(canEditMessage(formerMember, open, byAuthor)).toBe(false);
    expect(canDeleteMessage(formerMember, open, byAuthor)).toBe(false);
  });

  it('content from removed accounts belongs to nobody', () => {
    const orphanThread: ThreadRef = { ...open, authorId: null };
    const orphanMessage = { authorId: null };
    expect(canEditThread(reader, orphanThread)).toBe(false);
    expect(canEditMessage(reader, open, orphanMessage)).toBe(false);
    expect(canDeleteMessage(admin, open, orphanMessage)).toBe(true);
  });
});
