import {
  bearer,
  createTestApp,
  newEmail,
  nextSecond,
  PASSWORD,
  refreshCookie,
  type TestApp,
} from './helpers.js';

describe('Account management (e2e)', () => {
  let t: TestApp;
  const http = () => t.http();

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  it('changes the password, keeping this session and dropping the others', async () => {
    const email = newEmail('changepw');
    await t.createUser(email);
    const elsewhere = await t.login(email);
    await nextSecond();
    const here = await t.login(email);

    const wrong = await http()
      .post('/v1/me/password')
      .set(bearer(here.accessToken))
      .send({ currentPassword: 'not-my-password', newPassword: 'a-new-one-11' })
      .expect(401);
    expect(wrong.body.message).toBe('invalid_credentials');

    const newPassword = 'a-brand-new-password';
    const changed = await http()
      .post('/v1/me/password')
      .set(bearer(here.accessToken))
      .send({ currentPassword: PASSWORD, newPassword })
      .expect(200);

    // The caller is handed a fresh pair, so their tab carries on working...
    expect(changed.body.accessToken).toEqual(expect.any(String));
    await http()
      .get('/v1/me')
      .set(bearer(changed.body.accessToken))
      .expect(200);
    // ...while the session that was open elsewhere is finished, token and all.
    const stale = await http()
      .get('/v1/me')
      .set(bearer(elsewhere.accessToken))
      .expect(401);
    expect(stale.body.message).toBe('session_revoked');
    await http()
      .post('/v1/auth/refresh')
      .set('Cookie', elsewhere.cookie)
      .expect(401);

    await http()
      .post('/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(401);
    await t.login(email, newPassword);
  });

  it('moves the account to a new address once that address confirms', async () => {
    const email = newEmail('movepw');
    const target = newEmail('moved');
    await t.createUser(email);
    const taken = newEmail('occupied');
    await t.createUser(taken);
    const session = await t.login(email);

    await http()
      .post('/v1/me/email')
      .set(bearer(session.accessToken))
      .send({ currentPassword: 'wrong', newEmail: target })
      .expect(401);
    const clash = await http()
      .post('/v1/me/email')
      .set(bearer(session.accessToken))
      .send({ currentPassword: PASSWORD, newEmail: taken })
      .expect(409);
    expect(clash.body.message).toBe('email_taken');
    const same = await http()
      .post('/v1/me/email')
      .set(bearer(session.accessToken))
      .send({ currentPassword: PASSWORD, newEmail: email })
      .expect(400);
    expect(same.body.message).toBe('email_unchanged');

    await http()
      .post('/v1/me/email')
      .set(bearer(session.accessToken))
      .send({ currentPassword: PASSWORD, newEmail: target })
      .expect(202, { ok: true });

    // Nothing has moved yet: the old address still signs in, and the pending
    // one is visible to its owner.
    const pending = await http()
      .get('/v1/me')
      .set(bearer(session.accessToken))
      .expect(200);
    expect(pending.body).toMatchObject({ email, pendingEmail: target });
    // The old address is told, so a hijack doesn't go unnoticed.
    expect(t.mail.count('notice', email)).toBe(1);

    const token = t.mail.token('email-change', target);
    await http()
      .post('/v1/auth/confirm-email-change')
      .send({ token })
      .expect(200, { ok: true });

    // Single-use: the same link is spent.
    await http()
      .post('/v1/auth/confirm-email-change')
      .send({ token })
      .expect(400);

    await http()
      .post('/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(401);
    const moved = await t.login(target);
    const me = await http()
      .get('/v1/me')
      .set(bearer(moved.accessToken))
      .expect(200);
    expect(me.body).toMatchObject({
      email: target,
      pendingEmail: null,
      emailVerified: true,
    });
  });

  it('deletes the account, freeing the email and tag but keeping the threads', async () => {
    const email = newEmail('closing');
    await t.createUser(email);
    const session = await t.login(email);
    const { tag } = await t.prisma.user.findUniqueOrThrow({
      where: { email },
      select: { tag: true },
    });

    // Leave something behind that other people were part of.
    const thread = await t.prisma.thread.create({
      data: {
        subject: 'MATHEMATICS',
        title: 'Goodbye',
        authorId: session.userId,
        messages: { create: { authorId: session.userId, content: 'Bye' } },
      },
      select: { id: true },
    });

    await http()
      .delete('/v1/me')
      .set(bearer(session.accessToken))
      .send({ currentPassword: 'wrong' })
      .expect(401);

    const gone = await http()
      .delete('/v1/me')
      .set(bearer(session.accessToken))
      .send({ currentPassword: PASSWORD })
      .expect(204);
    // The refresh cookie is cleared on the way out.
    expect(refreshCookie(gone)).toBe('rt=');

    await http().get('/v1/me').set(bearer(session.accessToken)).expect(401);
    await http()
      .post('/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(401);

    // The discussion survives, with no author.
    const kept = await t.prisma.thread.findUniqueOrThrow({
      where: { id: thread.id },
      select: { authorId: true, messages: { select: { authorId: true } } },
    });
    expect(kept.authorId).toBeNull();
    expect(kept.messages.map((m) => m.authorId)).toEqual([null]);

    // And the address and tag are free again.
    expect(
      await t.prisma.user.findFirst({ where: { OR: [{ email }, { tag }] } }),
    ).toBeNull();
  });
});
