import type { Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request, { type Response } from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PasswordService } from '../src/auth/password.service.js';
import {
  FriendshipStatus,
  Role,
  type Subject,
} from '../src/generated/prisma/enums.js';
import { MailService } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { suggestTag } from '../src/users/user-tag.js';

export const PASSWORD = 'correct-horse-battery';

let seq = 0;
export const newEmail = (label: string) =>
  `${label}-${Date.now()}-${seq++}@example.com`;

/** Emails are unique per test run, so a tag derived from one is too. */
export const tagFor = (email: string) => suggestTag(email.split('@')[0]);

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export const refreshCookie = (res: Response) =>
  ([res.headers['set-cookie']].flat() as (string | undefined)[])
    .find((c) => c?.startsWith('rt='))
    ?.split(';')[0];

type MailKind = 'verify' | 'reset' | 'exists';

/** Captures outgoing emails so tests can follow the links. */
export class FakeMail {
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

export interface LoggedIn {
  accessToken: string;
  userId: string;
  cookie: string;
}

/** Boots the whole app against the test database, capturing emails instead of sending them. */
export async function createTestApp(extraControllers: Type[] = []) {
  const mail = new FakeMail();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: extraControllers,
  })
    .overrideProvider(MailService)
    .useValue(mail)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  // Listen on a real port so supertest reuses it instead of starting (and
  // closing) a temporary server per request, which breaks concurrent requests.
  await app.listen(0, '127.0.0.1');

  const prisma = app.get(PrismaService);
  const http = () => request(app.getHttpServer());

  /** A verified account written directly: no emails, no rate-limited endpoints. */
  const createUser = async (email: string, role: Role = Role.USER) => {
    await prisma.user.create({
      data: {
        email,
        passwordHash: await app.get(PasswordService).hash(PASSWORD),
        userName: role === Role.ADMIN ? 'Admin' : 'Test',
        role,
        emailVerifiedAt: new Date(),
        tag: tagFor(email),
      },
    });
  };

  return {
    app,
    prisma,
    mail,
    http,
    createUser,

    /** Same as `pnpm db:seed`: a verified admin with PASSWORD. */
    createAdmin: (email: string) => createUser(email, Role.ADMIN),

    async registerAndVerify(email: string, subjects: Subject[] = []) {
      await http()
        .post('/v1/auth/register')
        .send({
          email,
          password: PASSWORD,
          userName: 'Test',
          tag: tagFor(email),
          subjects,
        })
        .expect(202);
      await http()
        .post('/v1/auth/verify-email')
        .send({ token: mail.token('verify', email) })
        .expect(200);
    },

    async login(email: string, password = PASSWORD): Promise<LoggedIn> {
      const res = await http()
        .post('/v1/auth/login')
        .send({ email, password })
        .expect(200);
      return {
        accessToken: res.body.accessToken,
        userId: res.body.user.id,
        cookie: refreshCookie(res)!,
      };
    },

    /** Sets a role and subjects directly, without going through the admin API. */
    async grant(email: string, role: Role, subjects: Subject[]) {
      await prisma.user.update({
        where: { email },
        data: {
          role,
          subjects: {
            deleteMany: {},
            create: subjects.map((subject) => ({ subject })),
          },
        },
      });
    },

    close: () => app.close(),
  };
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;

export interface Person extends LoggedIn {
  tag: string;
}

/** Shared setup for the friends and blocks specs. */
export function friendTools(t: TestApp) {
  const http = () => t.http();

  return {
    /** A fresh verified user, logged in, with their tag. */
    async person(label: string): Promise<Person> {
      const email = newEmail(label);
      await t.createUser(email);
      const session = await t.login(email);
      const { tag } = await t.prisma.user.findUniqueOrThrow({
        where: { email },
        select: { tag: true },
      });
      return { ...session, tag };
    },

    sendRequest: (from: Person, tag: string) =>
      http()
        .post('/v1/friends/requests')
        .set(bearer(from.accessToken))
        .send({ tag }),

    /** Writes a friendship row directly, for tests that aren't about sending requests. */
    seedFriendship: (
      requester: Person,
      addressee: Person,
      status: FriendshipStatus = FriendshipStatus.PENDING,
    ) =>
      t.prisma.friendship.create({
        data: {
          requesterId: requester.userId,
          addresseeId: addressee.userId,
          status,
          acceptedAt: status === FriendshipStatus.ACCEPTED ? new Date() : null,
        },
      }),

    pairRows: (a: Person, b: Person) =>
      t.prisma.friendship.findMany({
        where: {
          OR: [
            { requesterId: a.userId, addresseeId: b.userId },
            { requesterId: b.userId, addresseeId: a.userId },
          ],
        },
      }),

    userIds: (res: Response) =>
      res.body.items.map((item: { user: { id: string } }) => item.user.id),
  };
}
