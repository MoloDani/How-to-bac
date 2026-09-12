import { Controller, Get, Patch } from '@nestjs/common';
import { SubjectAccess } from '../src/auth/decorators/subject-access.decorator.js';
import { Role, Subject } from '../src/generated/prisma/enums.js';
import {
  bearer,
  createTestApp,
  newEmail,
  PASSWORD,
  refreshCookie,
  type TestApp,
} from './helpers.js';

/** Stand-in for a future content controller, to exercise @SubjectAccess. */
@Controller('probe')
class SubjectProbeController {
  @Get(':subject')
  @SubjectAccess('view')
  view() {
    return { ok: true };
  }

  @Patch(':subject')
  @SubjectAccess('edit')
  edit() {
    return { ok: true };
  }
}

const ADMIN_EMAIL = 'admin@example.com';

describe('Auth (e2e)', () => {
  let t: TestApp;
  const http = () => t.http();

  beforeAll(async () => {
    t = await createTestApp([SubjectProbeController]);
    // The only admin in the test database, so "last admin" can be checked.
    await t.prisma.user.deleteMany({ where: { role: Role.ADMIN } });
    await t.createAdmin(ADMIN_EMAIL);
  });

  afterAll(async () => {
    await t.close();
  });

  it('blocks login until the email is verified', async () => {
    const email = newEmail('flow');

    await http()
      .post('/v1/auth/register')
      .send({
        email: `  ${email.toUpperCase()} `,
        password: PASSWORD,
        userName: 'Ana',
      })
      .expect(202, { ok: true });

    const blocked = await http()
      .post('/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(403);
    expect(blocked.body.message).toBe('email_not_verified');

    const wrong = await http()
      .post('/v1/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);
    expect(wrong.body.message).toBe('invalid_credentials');

    const token = t.mail.token('verify', email);
    await http().post('/v1/auth/verify-email').send({ token }).expect(200);
    await http().post('/v1/auth/verify-email').send({ token }).expect(400);

    const res = await http()
      .post('/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    expect(res.body.user).toMatchObject({
      email,
      userName: 'Ana',
      role: Role.USER,
      emailVerified: true,
    });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();

    const setCookie = [res.headers['set-cookie']].flat().join('\n');
    expect(setCookie).toMatch(/rt=.*HttpOnly/);
    expect(setCookie).toMatch(/Path=\/v1\/auth/);

    const me = await http()
      .get('/v1/me')
      .set(bearer(res.body.accessToken))
      .expect(200);
    expect(me.body.email).toBe(email);
  });

  it('rejects missing and invalid access tokens', async () => {
    const missing = await http().get('/v1/me').expect(401);
    expect(missing.body.message).toBe('missing_token');

    const invalid = await http()
      .get('/v1/me')
      .set(bearer('garbage'))
      .expect(401);
    expect(invalid.body.message).toBe('invalid_token');
  });

  it('answers a duplicate sign-up identically and emails the owner', async () => {
    const email = newEmail('dup');
    await t.registerAndVerify(email);

    await http()
      .post('/v1/auth/register')
      .send({ email, password: 'another-password', userName: 'Imposter' })
      .expect(202, { ok: true });
    expect(t.mail.count('exists', email)).toBe(1);

    // The original password still works.
    await t.login(email);
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const email = newEmail('rotate');
    await t.registerAndVerify(email);
    const { cookie: first } = await t.login(email);

    const rotated = await http()
      .post('/v1/auth/refresh')
      .set('Cookie', first)
      .expect(200);
    expect(rotated.body.accessToken).toEqual(expect.any(String));
    const second = refreshCookie(rotated)!;
    expect(second).not.toBe(first);

    // Replaying the old token looks like theft...
    await http().post('/v1/auth/refresh').set('Cookie', first).expect(401);
    // ...so the new one is dead too.
    await http().post('/v1/auth/refresh').set('Cookie', second).expect(401);
  });

  it('logout revokes the refresh token', async () => {
    const email = newEmail('logout');
    await t.registerAndVerify(email);
    const { cookie } = await t.login(email);

    await http().post('/v1/auth/logout').set('Cookie', cookie).expect(204);
    await http().post('/v1/auth/refresh').set('Cookie', cookie).expect(401);
  });

  it('password reset changes the password and ends existing sessions', async () => {
    const email = newEmail('reset');
    await t.registerAndVerify(email);
    const { cookie } = await t.login(email);

    await http()
      .post('/v1/auth/forgot-password')
      .send({ email })
      .expect(200, { ok: true });

    const unknown = newEmail('nobody');
    await http()
      .post('/v1/auth/forgot-password')
      .send({ email: unknown })
      .expect(200, { ok: true });
    expect(t.mail.count('reset', unknown)).toBe(0);

    const newPassword = 'a-brand-new-password';
    await http()
      .post('/v1/auth/reset-password')
      .send({ token: t.mail.token('reset', email), password: newPassword })
      .expect(200);

    await http().post('/v1/auth/refresh').set('Cookie', cookie).expect(401);
    await http()
      .post('/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(401);
    await t.login(email, newPassword);
  });

  it('gives mobile clients the refresh token in the body', async () => {
    const email = newEmail('mobile');
    await t.registerAndVerify(email);

    const res = await http()
      .post('/v1/auth/login')
      .set('X-Client-Type', 'mobile')
      .send({ email, password: PASSWORD })
      .expect(200);
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(refreshCookie(res)).toBeUndefined();

    const rotated = await http()
      .post('/v1/auth/refresh')
      .set('X-Client-Type', 'mobile')
      .send({ refreshToken: res.body.refreshToken })
      .expect(200);
    expect(rotated.body.refreshToken).toEqual(expect.any(String));
    expect(rotated.body.refreshToken).not.toBe(res.body.refreshToken);
  });

  it('enforces roles and subject access', async () => {
    const admin = await t.login(ADMIN_EMAIL);

    // A regular user picks subjects (max 3) and can only view them.
    const userEmail = newEmail('user');
    await t.registerAndVerify(userEmail, [Subject.MATHEMATICS]);
    const user = await t.login(userEmail);

    await http()
      .put('/v1/me/subjects')
      .set(bearer(user.accessToken))
      .send({
        subjects: [
          Subject.MATHEMATICS,
          Subject.ROMANIAN,
          Subject.HISTORY,
          Subject.LOGIC,
        ],
      })
      .expect(400);
    const picked = await http()
      .put('/v1/me/subjects')
      .set(bearer(user.accessToken))
      .send({
        subjects: [Subject.MATHEMATICS, Subject.ROMANIAN, Subject.HISTORY],
      })
      .expect(200);
    expect(picked.body.subjects).toHaveLength(3);

    const asUser = bearer(user.accessToken);
    await http().get('/v1/probe/mathematics').set(asUser).expect(200);
    await http().patch('/v1/probe/mathematics').set(asUser).expect(403);
    await http().get('/v1/probe/physics').set(asUser).expect(403);
    await http().get('/v1/probe/astrology').set(asUser).expect(400);
    await http().get('/v1/admin/users').set(asUser).expect(403);

    // An admin turns someone into a PHYSICS contributor.
    const contributorEmail = newEmail('contributor');
    await t.registerAndVerify(contributorEmail);
    const { userId: contributorId } = await t.login(contributorEmail);

    await http()
      .patch(`/v1/admin/users/${contributorId}/role`)
      .set(bearer(admin.accessToken))
      .send({ role: Role.CONTRIBUTOR })
      .expect(200);
    const assigned = await http()
      .put(`/v1/admin/users/${contributorId}/subjects`)
      .set(bearer(admin.accessToken))
      .send({ subjects: [Subject.PHYSICS] })
      .expect(200);
    expect(assigned.body).toMatchObject({
      role: Role.CONTRIBUTOR,
      subjects: [Subject.PHYSICS],
    });

    const contributor = await t.login(contributorEmail);
    const asContributor = bearer(contributor.accessToken);
    await http().patch('/v1/probe/physics').set(asContributor).expect(200);
    await http().get('/v1/probe/physics').set(asContributor).expect(200);
    await http().patch('/v1/probe/mathematics').set(asContributor).expect(403);
    await http()
      .put('/v1/me/subjects')
      .set(asContributor)
      .send({ subjects: [Subject.MATHEMATICS] })
      .expect(403);

    // Admins can do anything, but the last one can't be demoted.
    await http()
      .patch('/v1/probe/geography')
      .set(bearer(admin.accessToken))
      .expect(200);
    const list = await http()
      .get('/v1/admin/users')
      .query({ role: Role.CONTRIBUTOR })
      .set(bearer(admin.accessToken))
      .expect(200);
    expect(list.body.items.map((u: { id: string }) => u.id)).toContain(
      contributorId,
    );

    const demote = await http()
      .patch(`/v1/admin/users/${admin.userId}/role`)
      .set(bearer(admin.accessToken))
      .send({ role: Role.USER })
      .expect(409);
    expect(demote.body.message).toBe('last_admin');
  });
});
