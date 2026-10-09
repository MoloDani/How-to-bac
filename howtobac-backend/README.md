# How to Bac API

NestJS 12 on ESM, Prisma 7 against Postgres, Zod for every request body. Served
under the `/v1` prefix. See the [repository README](../README.md) for the project
as a whole and how it's deployed.

## Setup

```bash
cp .env.example .env     # fill DATABASE_URL and JWT_ACCESS_SECRET at least
pnpm install             # postinstall generates the Prisma client
pnpm db:deploy           # apply migrations
pnpm db:seed             # optional: create or promote the first admin
```

`pnpm start:dev` runs it on `PORT` (3000 by default) with Swagger UI at
[`/docs`](http://localhost:3000/docs); `pnpm start:prod` runs the build.
The app validates its environment on boot and refuses to start on bad config
([src/config/env.ts](src/config/env.ts)).

## Scripts

| Command            | What it does                                                             |
| ------------------ | ------------------------------------------------------------------------ |
| `pnpm test`        | unit tests (Vitest)                                                      |
| `pnpm test:e2e`    | end-to-end tests — **wipes `TEST_DATABASE_URL`**                         |
| `pnpm lint`        | oxlint                                                                   |
| `pnpm build`       | compile to `dist/`                                                       |
| `pnpm db:deploy`   | apply pending migrations (use this on the server)                        |
| `pnpm db:migrate`  | create a new migration from schema changes (needs `SHADOW_DATABASE_URL`) |
| `pnpm db:generate` | regenerate the Prisma client after a schema change                       |

## Layout

```
src/
  auth/        sign-up, sign-in, tokens, guards and the access policy
  users/       /me, admin user management, user tags
  threads/     per-subject threads and their messages
  friends/     friend requests, friendships and blocks
  mail/        Resend, with templates (logs links when RESEND_API_KEY is empty)
  maintenance/ the nightly job that prunes expired tokens
  common/      pagination, subject schemas, rate limiting
  config/      environment validation
prisma/        schema, migrations, seed
test/          end-to-end specs
```

Three global guards run in order — rate limit, authenticate, authorize — so a
route is protected unless it says `@Public()`. `@Roles()` and `@SubjectAccess()`
narrow it further.

## Things to know

- **Rate limits** are keyed on the account when a request carries an access
  token, and on the IP otherwise ([src/common/throttle.ts](src/common/throttle.ts)).
  Set `TRUST_PROXY` to the number of proxies in front of the API, or the IP
  fallback sees the proxy's address instead of the client's.
- **`sessionsValidFrom`** on the user row retires every access token issued
  before it. A password reset or role change moves it forward, so those take
  effect immediately rather than after the 15-minute token expiry.
- **Two constraints exist only in migration SQL** (`friendships_pair_key` and
  the `friendships_not_self` check) because the Prisma schema can't express
  them. Prisma doesn't know about them, so check what `pnpm db:migrate`
  generates and drop any statement that removes them.
- **Telemetry** is off unless `OBSERVE_APP_KEY` and `OBSERVE_APP_SECRET` are
  both set ([NestJS Observe](https://observe.nestjs.com)).
- **`GET /v1/health`** reports whether the API can reach Postgres; `GET /v1`
  only proves the process is listening.
