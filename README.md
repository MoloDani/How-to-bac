# How to Bac

A study platform for the Romanian baccalaureate: students pick their exam subjects
and discuss them in per-subject threads, with contributors moderating the subjects
they're responsible for.

The site runs at **[howtobac.ro](https://howtobac.ro)**, with the API served from
the same origin under `/v1`.

| Folder                                    | What it is  | Stack                                                      |
| ----------------------------------------- | ----------- | ---------------------------------------------------------- |
| [`howtobac-backend/`](howtobac-backend)   | the API     | NestJS 12 (ESM), Prisma 7, Postgres, Zod                   |
| [`howtobac-frontend/`](howtobac-frontend) | the web app | TanStack Start (SPA mode), React 19, Tailwind 4, shadcn/ui |

Both are separate pnpm projects — install and run them independently. They need
**Node 24+** (frontend 22+) and **pnpm 12**; `corepack enable` picks up the
version pinned in each `package.json`.

## What exists today

- **Accounts** — email + password (argon2id), email verification required before
  the first sign-in, password reset, rotating refresh tokens in an httpOnly
  cookie, roles `ADMIN` / `CONTRIBUTOR` / `USER`.
- **Subjects** — the 15 bac subjects. Students pick up to 3 themselves;
  contributors and admins are assigned theirs. Access decides what you can read
  and moderate ([access-policy.ts](howtobac-backend/src/auth/access-policy.ts),
  mirrored in the UI by [permissions.ts](howtobac-frontend/src/lib/permissions.ts)).
- **Threads** — Discord-style forum threads per subject, with replies, edits,
  soft delete, pin and lock.
- **Friends** — requests by public `@tag`, mutual requests auto-accept, blocking.
- **Romanian and English**, Romanian by default.

## Running it locally

```bash
# API — needs a Postgres it may create tables in
cd howtobac-backend
cp .env.example .env            # then fill DATABASE_URL and JWT_ACCESS_SECRET
pnpm install
pnpm db:deploy                  # apply migrations
pnpm db:seed                    # optional: create or promote the first admin
pnpm start:dev                  # http://localhost:3000/v1, docs at /docs

# Web app, in a second terminal
cd howtobac-frontend
pnpm install
pnpm dev                        # http://localhost:3000, proxying /v1 to the API
```

Set `VITE_DEV_API_TARGET=http://127.0.0.1:3000` in `howtobac-frontend/.env` to
develop against the API on your own machine instead of the deployed one.

Every environment variable is documented in
[`howtobac-backend/.env.example`](howtobac-backend/.env.example) and
[`howtobac-frontend/.env.example`](howtobac-frontend/.env.example); the API
refuses to boot if any required one is missing or malformed
([config/env.ts](howtobac-backend/src/config/env.ts)).

## Tests

```bash
cd howtobac-backend  && pnpm test && pnpm test:e2e   # unit, then end-to-end
cd howtobac-frontend && pnpm test
```

`pnpm test:e2e` **wipes the database in `TEST_DATABASE_URL`** — point it at a
database you don't mind losing, and never at the one in `DATABASE_URL` (the
setup refuses if they match).

Before pushing: `pnpm lint`, `pnpm exec tsc --noEmit` and `pnpm build` in the
backend; `pnpm lint`, `pnpm typecheck`, `pnpm check` and `pnpm build` in the
frontend.

## How it's deployed

[Coolify](https://coolify.io) on the home server builds both images from this
repository and deploys them on a push to `main`:

```
                 Cloudflare (optional proxy)
                            │
                  Coolify's Traefik
                   │                 │
        howtobac.ro│                 │api.howtobac.ro
                   ▼                 ▼
        web (nginx + static)   api (Node 24)
                                        │
                                   Postgres
                                 192.168.3.103:5432
```

Each app has a `Dockerfile`; Postgres stays in its own container outside
Coolify, reached through `DATABASE_URL`. A deploy runs `prisma migrate deploy`
in the new API image before the container goes live, so a release is a `git
push` and nothing else.

**[DEPLOY.md](DEPLOY.md) has the whole of it**: the two Coolify applications and
every setting they need, the environment tables, certificates and Cloudflare,
rollback, and a table of what to check when something misbehaves.

Two details worth knowing here:

- The app and the API are **different origins**, so `CORS_ORIGINS` has to list
  the origins the app is served from. The refresh cookie still works because
  both are `howtobac.ro` subdomains.
- `VITE_API_URL` is **compiled into the bundle**, so changing it means a
  rebuild, not a restart.

Check a release with `curl https://api.howtobac.ro/v1/health`: it answers `200`
only if the API can reach Postgres.

## Things worth knowing before you change something

- **Two constraints live only in migration SQL**, because Prisma's schema can't
  express them: `friendships_pair_key` (one row per pair of users, whichever
  direction the request went) and the `friendships_not_self` check. Prisma
  doesn't know they exist, so read the SQL that `pnpm db:migrate` generates and
  delete any `DROP INDEX`/`DROP CONSTRAINT` it invents for them.
- **The frontend's [types.ts](howtobac-frontend/src/lib/api/types.ts) is a
  hand-kept copy of the API's response shapes.** The e2e specs assert the exact
  keys of each payload, so a backend change that alters one fails a test —
  update both sides together.
- **Rate limits are per account** where a request carries a token, and per IP
  otherwise ([throttle.ts](howtobac-backend/src/common/throttle.ts)). `TRUST_PROXY`
  has to match the number of proxies in front of the API or the IP fallback keys
  everyone to the same bucket.
- **The generated Prisma client is not committed** (`src/generated/`), so after
  pulling a schema change run `pnpm db:generate` — or just `pnpm install`.
