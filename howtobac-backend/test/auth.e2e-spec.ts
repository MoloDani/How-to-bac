import { Controller, Get, Patch } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request, { type Response } from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { SubjectAccess } from '../src/auth/decorators/subject-access.decorator.js';
import { PasswordService } from '../src/auth/password.service.js';
import { Role, Subject } from '../src/generated/prisma/enums.js';
import { MailService } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

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

type MailKind = 'verify' | 'reset' | 'exists';

/** Captures outgoing emails so tests can follow the links. */
class FakeMail {
  sent: { kind: MailKind; to: string; token?: string }[] = [];

  async sendVerificationEmail(to: string, token: string) {
    this.sent.push({ kind: 'verify', to, token });
  }
  async sendPasswordResetEmail(to: string, token: string) {
    this.sent.push({ kind: 'reset', to, token });
  }
  async sendAccountExistsEmail(to: string) {
    this.sent.push({ kind: 'exists', to });
  }

  count(kind: MailKind, to: string) {
    return this.sent.filter((m) => m.kind === kind && m.to === to).length;
  }

  token(kind: MailKind, to: string) {
    const mail = this.sent.findLast((m) => m.kind === kind && m.to === to);
    if (!mail?.token) throw new Error(`no ${kind} email sent to ${to}`);
    return mail.token;
  }
}

const PASSWORD = 'correct-horse-battery';
const ADMIN_EMAIL = 'admin@example.com';
let seq = 0;
const newEmail = (label: string) =>
  `${label}-${Date.now()}-${seq++}@example.com`;

const refreshCookie = (res: Response) =>
  ([res.headers['set-cookie']].flat() as (string | undefined)[])
    .find((c) => c?.startsWith('rt='))
    ?.split(';')[0];

describe('Auth (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const mail = new FakeMail();

  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function registerAndVerify(email: string, subjects: Subject[] = []) {
    await http()
      .post('/v1/auth/register')
      .send({ email, password: PASSWORD, userName: 'Test', subjects })
      .expect(202);
    await http()
      .post('/v1/auth/verify-email')
      .send({ token: mail.token('verify', email) })
      .expect(200);
  }

  async function login(email: string, password = PASSWORD) {
    const res = await http()
      .post('/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return {
      accessToken: res.body.accessToken as string,
      userId: res.body.user.id as string,
      cookie: refreshCookie(res)!,
    };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [SubjectProbeController],
    })
      .overrideProvider(MailService)
      .useValue(mail)
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    // Same as `pnpm db:seed`: the only admin in the test database.
    await prisma.user.deleteMany({ where: { role: Role.ADMIN } });
    await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        passwordHash: await app.get(PasswordService).hash(PASSWORD),
        userName: 'Admin',
        role: Role.ADMIN,
        emailVerifiedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await app.close();
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

    const token = mail.token('verify', email);
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
    await registerAndVerify(email);

    await http()
      .post('/v1/auth/register')
      .send({ email, password: 'another-password', userName: 'Imposter' })
      .expect(202, { ok: true });
    expect(mail.count('exists', email)).toBe(1);

    // The original password still works.
    await login(email);
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const email = newEmail('rotate');
    await registerAndVerify(email);
    const { cookie: first } = await login(email);

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
    await registerAndVerify(email);
    const { cookie } = await login(email);

    await http().post('/v1/auth/logout').set('Cookie', cookie).expect(204);
    await http().post('/v1/auth/refresh').set('Cookie', cookie).expect(401);
  });

  it('password reset changes the password and ends existing sessions', async () => {
    const email = newEmail('reset');
    await registerAndVerify(email);
    const { cookie } = await login(email);

    await http()
      .post('/v1/auth/forgot-password')
      .send({ email })
      .expect(200, { ok: true });

    const unknown = newEmail('nobody');
    await http()
      .post('/v1/auth/forgot-password')
      .send({ email: unknown })
      .expect(200, { ok: true });
    expect(mail.count('reset', unknown)).toBe(0);

    const newPassword = 'a-brand-new-password';
    await http()
      .post('/v1/auth/reset-password')
      .send({ token: mail.token('reset', email), password: newPassword })
      .expect(200);

    await http().post('/v1/auth/refresh').set('Cookie', cookie).expect(401);
    await http()
      .post('/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(401);
    await login(email, newPassword);
  });

  it('gives mobile clients the refresh token in the body', async () => {
    const email = newEmail('mobile');
    await registerAndVerify(email);

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
    const admin = await login(ADMIN_EMAIL);

    // A regular user picks subjects (max 3) and can only view them.
    const userEmail = newEmail('user');
    await registerAndVerify(userEmail, [Subject.MATHEMATICS]);
    const user = await login(userEmail);

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

    await http()
      .get('/v1/probe/mathematics')
      .set(bearer(user.accessToken))
      .expect(200);
    await http()
      .patch('/v1/probe/mathematics')
      .set(bearer(user.accessToken))
      .expect(403);
    await http()
      .get('/v1/probe/physics')
      .set(bearer(user.accessToken))
      .expect(403);
    await http()
      .get('/v1/probe/astrology')
      .set(bearer(user.accessToken))
      .expect(400);
    await http()
      .get('/v1/admin/users')
      .set(bearer(user.accessToken))
      .expect(403);

    // An admin turns someone into a PHYSICS contributor.
    const contributorEmail = newEmail('contributor');
    await registerAndVerify(contributorEmail);
    const { userId: contributorId } = await login(contributorEmail);

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

    const contributor = await login(contributorEmail);
    await http()
      .patch('/v1/probe/physics')
      .set(bearer(contributor.accessToken))
      .expect(200);
    await http()
      .get('/v1/probe/physics')
      .set(bearer(contributor.accessToken))
      .expect(200);
    await http()
      .patch('/v1/probe/mathematics')
      .set(bearer(contributor.accessToken))
      .expect(403);
    await http()
      .put('/v1/me/subjects')
      .set(bearer(contributor.accessToken))
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
