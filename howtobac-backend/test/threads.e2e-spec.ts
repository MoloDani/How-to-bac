import type { Response } from 'supertest';
import { Role, Subject } from '../src/generated/prisma/enums.js';
import {
  bearer,
  createTestApp,
  newEmail,
  type LoggedIn,
  type TestApp,
} from './helpers.js';

interface IdOnly {
  id: string;
}

describe('Threads (e2e)', () => {
  let t: TestApp;
  const http = () => t.http();

  // alice and bob picked MATHEMATICS, carol picked PHYSICS.
  let alice: LoggedIn;
  let bob: LoggedIn;
  let carol: LoggedIn;
  let mathMod: LoggedIn;
  let physicsMod: LoggedIn;
  let admin: LoggedIn;

  beforeAll(async () => {
    t = await createTestApp();

    const emails = {
      alice: newEmail('alice'),
      bob: newEmail('bob'),
      carol: newEmail('carol'),
      mathMod: newEmail('math-mod'),
      physicsMod: newEmail('physics-mod'),
      admin: newEmail('threads-admin'),
    };
    await t.registerAndVerify(emails.alice, [Subject.MATHEMATICS]);
    await t.registerAndVerify(emails.bob, [Subject.MATHEMATICS]);
    await t.registerAndVerify(emails.carol, [Subject.PHYSICS]);
    await t.registerAndVerify(emails.mathMod);
    await t.grant(emails.mathMod, Role.CONTRIBUTOR, [Subject.MATHEMATICS]);
    await t.registerAndVerify(emails.physicsMod);
    await t.grant(emails.physicsMod, Role.CONTRIBUTOR, [Subject.PHYSICS]);
    await t.createAdmin(emails.admin);

    [alice, bob, carol, mathMod, physicsMod, admin] = await Promise.all([
      t.login(emails.alice),
      t.login(emails.bob),
      t.login(emails.carol),
      t.login(emails.mathMod),
      t.login(emails.physicsMod),
      t.login(emails.admin),
    ]);
  });

  afterAll(async () => {
    await t.close();
  });

  // Posting is rate limited per IP, so only the requests under test go through
  // the API; the rest of the setup is written straight to the database.
  const createThread = async (as: LoggedIn, title: string, content: string) =>
    (
      await http()
        .post('/v1/subjects/mathematics/threads')
        .set(bearer(as.accessToken))
        .send({ title, content })
        .expect(201)
    ).body;

  const seedThread = (authorId: string, title: string) =>
    t.prisma.thread.create({
      data: {
        subject: Subject.MATHEMATICS,
        title,
        authorId,
        messages: { create: { authorId, content: `${title}: opening post` } },
      },
      select: { id: true, messages: { select: { id: true } } },
    });

  const messagesOf = async (as: LoggedIn, threadId: string) =>
    (
      await http()
        .get(`/v1/threads/${threadId}/messages`)
        .set(bearer(as.accessToken))
        .expect(200)
    ).body.items;

  it('creates a thread and keeps it inside its subject', async () => {
    const res = await http()
      .post('/v1/subjects/mathematics/threads')
      .set(bearer(alice.accessToken))
      .send({
        title: '  Derivatives  ',
        content: 'How do I differentiate x^2?',
      })
      .expect(201);
    expect(res.body).toMatchObject({
      subject: Subject.MATHEMATICS,
      title: 'Derivatives',
      pinned: false,
      locked: false,
      messageCount: 1,
      author: { id: alice.userId, userName: 'Test', role: Role.USER },
    });
    // Other users never see an author's email.
    expect(Object.keys(res.body.author).sort()).toEqual([
      'id',
      'role',
      'userName',
    ]);
    const threadId = res.body.id;

    const list = await http()
      .get('/v1/subjects/MATHEMATICS/threads')
      .set(bearer(bob.accessToken))
      .expect(200);
    expect(list.body.items.map((th: IdOnly) => th.id)).toContain(threadId);

    const asCarol = bearer(carol.accessToken);
    const denied = await http()
      .get('/v1/subjects/mathematics/threads')
      .set(asCarol)
      .expect(403);
    expect(denied.body.message).toBe('subject_access_denied');
    await http().get(`/v1/threads/${threadId}`).set(asCarol).expect(403);
    await http()
      .get(`/v1/threads/${threadId}/messages`)
      .set(asCarol)
      .expect(403);
    await http()
      .post(`/v1/threads/${threadId}/messages`)
      .set(asCarol)
      .send({ content: 'hi' })
      .expect(403);

    await http()
      .post('/v1/subjects/astrology/threads')
      .set(bearer(alice.accessToken))
      .send({ title: 'Stars', content: 'Are they real?' })
      .expect(400);
  });

  it('replies within the thread and only lets authors edit', async () => {
    const thread = await createThread(alice, 'Limits', 'What is lim sin(x)/x?');
    const [opening] = await messagesOf(bob, thread.id);

    const reply = await http()
      .post(`/v1/threads/${thread.id}/messages`)
      .set(bearer(bob.accessToken))
      .send({ content: 'It is 1', replyToId: opening.id })
      .expect(201);
    expect(reply.body).toMatchObject({
      replyToId: opening.id,
      content: 'It is 1',
      edited: false,
      deleted: false,
    });

    const other = await seedThread(bob.userId, 'Integrals');
    const cross = await http()
      .post(`/v1/threads/${thread.id}/messages`)
      .set(bearer(alice.accessToken))
      .send({ content: 'wrong thread', replyToId: other.messages[0].id })
      .expect(400);
    expect(cross.body.message).toBe('reply_to_not_in_thread');

    const edited = await http()
      .patch(`/v1/messages/${opening.id}`)
      .set(bearer(alice.accessToken))
      .send({ content: 'What is lim sin(x)/x as x → 0?' })
      .expect(200);
    expect(edited.body).toMatchObject({
      edited: true,
      content: 'What is lim sin(x)/x as x → 0?',
    });

    // Not even moderators may change someone else's words.
    for (const stranger of [bob, mathMod]) {
      const res = await http()
        .patch(`/v1/messages/${opening.id}`)
        .set(bearer(stranger.accessToken))
        .send({ content: 'rewritten' })
        .expect(403);
      expect(res.body.message).toBe('not_author');
    }
  });

  it('lets moderators of the subject lock and pin threads', async () => {
    const thread = await seedThread(alice.userId, 'Lock me');
    const older = await seedThread(bob.userId, 'Pin me');
    await t.prisma.thread.update({
      where: { id: older.id },
      data: { lastMessageAt: new Date(Date.now() - 86_400_000) },
    });
    const moderation = `/v1/threads/${thread.id}/moderation`;

    const otherSubject = await http()
      .patch(moderation)
      .set(bearer(physicsMod.accessToken))
      .send({ locked: true })
      .expect(403);
    expect(otherSubject.body.message).toBe('subject_access_denied');

    const member = await http()
      .patch(moderation)
      .set(bearer(bob.accessToken))
      .send({ locked: true })
      .expect(403);
    expect(member.body.message).toBe('not_moderator');

    await http()
      .patch(moderation)
      .set(bearer(mathMod.accessToken))
      .send({})
      .expect(400);
    const locked = await http()
      .patch(moderation)
      .set(bearer(mathMod.accessToken))
      .send({ locked: true })
      .expect(200);
    expect(locked.body.locked).toBe(true);

    const blocked = await http()
      .post(`/v1/threads/${thread.id}/messages`)
      .set(bearer(bob.accessToken))
      .send({ content: 'hello?' })
      .expect(403);
    expect(blocked.body.message).toBe('thread_locked');
    await http()
      .post(`/v1/threads/${thread.id}/messages`)
      .set(bearer(mathMod.accessToken))
      .send({ content: 'Locked, see the pinned thread.' })
      .expect(201);

    await http()
      .patch(`/v1/threads/${older.id}/moderation`)
      .set(bearer(admin.accessToken))
      .send({ pinned: true })
      .expect(200);
    const list = await http()
      .get('/v1/subjects/mathematics/threads')
      .set(bearer(alice.accessToken))
      .expect(200);
    expect(list.body.items[0].id).toBe(older.id);
  });

  it('leaves a placeholder when a message is deleted', async () => {
    const thread = await seedThread(alice.userId, 'Deleting messages');
    const [opening] = thread.messages;
    const reply = await t.prisma.message.create({
      data: { threadId: thread.id, authorId: bob.userId, content: 'my reply' },
      select: { id: true },
    });

    // The thread's author doesn't own the replies.
    await http()
      .delete(`/v1/messages/${reply.id}`)
      .set(bearer(alice.accessToken))
      .expect(403);
    await http()
      .delete(`/v1/messages/${reply.id}`)
      .set(bearer(bob.accessToken))
      .expect(204);
    await http()
      .delete(`/v1/messages/${reply.id}`)
      .set(bearer(bob.accessToken))
      .expect(404);
    // A moderator may remove anyone's message.
    await http()
      .delete(`/v1/messages/${opening.id}`)
      .set(bearer(mathMod.accessToken))
      .expect(204);

    const items = await messagesOf(alice, thread.id);
    expect(items).toHaveLength(2);
    expect(items.find((m: IdOnly) => m.id === reply.id)).toMatchObject({
      deleted: true,
      content: null,
    });

    const summary = await http()
      .get(`/v1/threads/${thread.id}`)
      .set(bearer(alice.accessToken))
      .expect(200);
    expect(summary.body.messageCount).toBe(0);
  });

  it('deleting a thread hides it and everything in it, but keeps the rows', async () => {
    const thread = await createThread(alice, 'To be deleted', 'Temporary');
    const reply = await http()
      .post(`/v1/threads/${thread.id}/messages`)
      .set(bearer(bob.accessToken))
      .send({ content: 'A reply' })
      .expect(201);

    const notYours = await http()
      .delete(`/v1/threads/${thread.id}`)
      .set(bearer(bob.accessToken))
      .expect(403);
    expect(notYours.body.message).toBe('not_author');
    // The author may delete it, other people's replies included.
    await http()
      .delete(`/v1/threads/${thread.id}`)
      .set(bearer(alice.accessToken))
      .expect(204);

    // Built lazily: supertest closes its temporary server after each request.
    const underDeletedThread = [
      () =>
        http().get(`/v1/threads/${thread.id}`).set(bearer(alice.accessToken)),
      () =>
        http()
          .get(`/v1/threads/${thread.id}/messages`)
          .set(bearer(alice.accessToken)),
      () =>
        http()
          .post(`/v1/threads/${thread.id}/messages`)
          .set(bearer(alice.accessToken))
          .send({ content: 'anyone here?' }),
      () =>
        http()
          .patch(`/v1/messages/${reply.body.id}`)
          .set(bearer(bob.accessToken))
          .send({ content: 'edit' }),
      () =>
        http()
          .delete(`/v1/messages/${reply.body.id}`)
          .set(bearer(bob.accessToken)),
    ];
    for (const send of underDeletedThread) {
      const res = await send();
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('thread_not_found');
    }

    const list = await http()
      .get('/v1/subjects/mathematics/threads')
      .query({ limit: 100 })
      .set(bearer(alice.accessToken))
      .expect(200);
    expect(list.body.items.map((th: IdOnly) => th.id)).not.toContain(thread.id);

    const row = await t.prisma.thread.findUniqueOrThrow({
      where: { id: thread.id },
      select: { deletedAt: true, messages: { select: { deletedAt: true } } },
    });
    expect(row.deletedAt).not.toBeNull();
    expect(row.messages).toHaveLength(2);
    expect(row.messages.every((m) => m.deletedAt === null)).toBe(true);
  });

  it('pages through messages in order with the after cursor', async () => {
    const thread = await seedThread(alice.userId, 'Pagination');
    for (let i = 1; i < 25; i++) {
      await t.prisma.message.create({
        data: { threadId: thread.id, authorId: bob.userId, content: `#${i}` },
      });
    }
    const expected = (
      await t.prisma.message.findMany({
        where: { threadId: thread.id },
        orderBy: { id: 'asc' },
        select: { id: true },
      })
    ).map((m) => m.id);
    expect(expected).toHaveLength(25);

    const seen: string[] = [];
    let after: string | null = null;
    do {
      const res: Response = await http()
        .get(`/v1/threads/${thread.id}/messages`)
        .query({ limit: 10, ...(after ? { after } : {}) })
        .set(bearer(alice.accessToken))
        .expect(200);
      expect(res.body.items.length).toBeLessThanOrEqual(10);
      seen.push(...res.body.items.map((m: IdOnly) => m.id));
      after = res.body.nextCursor;
    } while (after);

    expect(seen).toEqual(expected);
  });
});
