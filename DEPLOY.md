# Deploying How to Bac with Coolify

Both halves of the project are containerised and deployed by [Coolify](https://coolify.io)
running on the home server. A push to `main` rebuilds the images, applies any
pending database migrations, and swaps the containers over.

```
                 Cloudflare (optional proxy)
                            │
                  Coolify's Traefik  ── Let's Encrypt certificates
                   │                 │
        howtobac.ro│                 │api.howtobac.ro
                   ▼                 ▼
        web (nginx + static)   api (Node 24)
          howtobac-frontend      howtobac-backend
                                        │
                                   Postgres
                                 192.168.3.103:5432   (not managed by Coolify)
```

Postgres stays in its own container on the database host; Coolify only gets a
`DATABASE_URL`. The images are defined by
[`howtobac-backend/Dockerfile`](howtobac-backend/Dockerfile) and
[`howtobac-frontend/Dockerfile`](howtobac-frontend/Dockerfile).

## Before the first deploy

- Ports **80 and 443** reachable from the internet to the Coolify host —
  Let's Encrypt validates over HTTP, so a blocked port 80 means no certificate.
- Coolify's proxy running: **Servers → (server) → Proxy**.
- DNS records for the hostnames you're about to use, pointing at the host and
  set to **DNS-only (grey cloud)** in Cloudflare until the certificate is issued.
- The Coolify host must reach **192.168.3.103:5432**. If it isn't the machine
  that used to run the API, Postgres' `pg_hba.conf` may need its address added.
  This is the one prerequisite that can't be fixed from the Coolify UI.

## One-time setup

### 1. Connect GitHub

**Sources → + Add → GitHub App**, then install it on `MoloDani/How-to-bac`.
This is what makes a push to `main` deploy by itself.

### 2. Create the project

**Projects → + Add**, named `howtobac`, using its default `production`
environment. Keeping both applications in one project puts them on the same
Docker network and groups their logs.

### 3. The API application

**+ New Resource → Application → GitHub App → How-to-bac**, branch `main`,
build pack **Dockerfile**.

| Setting                | Value                                     |
| ---------------------- | ----------------------------------------- |
| Base Directory         | `/howtobac-backend`                       |
| Dockerfile Location    | `/Dockerfile`                             |
| Ports Exposes          | `3000`                                    |
| Domains                | `https://api.howtobac.ro`                 |
| Health Check → Path    | `/v1/health`                              |
| Health Check → Port    | `3000`                                    |
| Pre-deployment Command | `node_modules/.bin/prisma migrate deploy` |

Environment variables — all runtime, none marked as build variables:

| Variable            | Value                                                                          |
| ------------------- | ------------------------------------------------------------------------------ |
| `DATABASE_URL`      | `postgresql://howtobac:<password>@192.168.3.103:5432/howtobac?schema=howtobac` |
| `JWT_ACCESS_SECRET` | the existing secret, so sessions survive the move                              |
| `RESEND_API_KEY`    | from Resend                                                                    |
| `MAIL_FROM`         | `How to Bac <noreply@howtobac.ro>` — must be a verified sender                 |
| `APP_BASE_URL`      | `https://howtobac.ro` (used for the links in emails)                           |
| `CORS_ORIGINS`      | `https://howtobac.ro,https://www.howtobac.ro`                                  |
| `COOKIE_SECURE`     | `true`                                                                         |
| `COOKIE_SAMESITE`   | `lax`                                                                          |
| `TRUST_PROXY`       | `1`, or `2` when Cloudflare's proxy is in front of Traefik                     |
| `NODE_ENV`          | `production`                                                                   |
| `PORT`              | `3000`                                                                         |

Leave **`TEST_DATABASE_URL` unset** — the e2e suite wipes whatever it points at —
and `SHADOW_DATABASE_URL` too, which only matters when authoring migrations.
Set `SWAGGER_ENABLED=true` with `SWAGGER_USER` and `SWAGGER_PASSWORD` only if
you want `/docs` reachable in production.

### 4. The web application

**+ New Resource** from the same repository, build pack **Dockerfile**.

| Setting             | Value                                              |
| ------------------- | -------------------------------------------------- |
| Base Directory      | `/howtobac-frontend`                               |
| Dockerfile Location | `/Dockerfile`                                      |
| Ports Exposes       | `80`                                               |
| Domains             | `https://howtobac.ro` (redirect `www` to the apex) |
| Health Check → Path | `/`                                                |

One variable, with **Build Variable** ticked:

| Variable       | Value                        |
| -------------- | ---------------------------- |
| `VITE_API_URL` | `https://api.howtobac.ro/v1` |

Vite compiles that into the bundle, so it must exist at build time and a change
to it needs a **redeploy**, not a restart. `.env.production` holds the same
value as the default for local builds.

### 5. Certificates and Cloudflare

Deploy each application once its domain resolves to the host; Coolify requests
the certificate during that deploy. After both show a certificate, turning
Cloudflare's proxy back on (orange cloud) is optional — but if you do, its SSL
mode must be **Full (strict)**. "Flexible" is what produces a 525 from
Cloudflare, because it insists on plain HTTP to an origin that only speaks
HTTPS. Switching the proxy on also means `TRUST_PROXY=2`.

## Releasing

Push to `main`. Coolify builds both images, runs `prisma migrate deploy` in the
new API image before starting it, and swaps the containers.

Nothing else is needed — in particular there's no rsync and no manual migration
step. Two things to keep in mind:

- **A failed migration aborts that deploy** and leaves the running container
  alone, which is the behaviour you want. Fix the migration and push again.
- **A release that changes the API's responses needs both apps deployed**, which
  a push does automatically. The payload-shape assertions in the backend's e2e
  specs exist to catch the case where only one side was updated.

### Rollback

Each application's **Deployments** list has a redeploy button per build, so
rolling back is picking the previous one. That rolls back _code_, not the
database: a migration that has already applied stays applied, so a rollback
across one is only safe if the old code tolerates the new schema (adding a
column with a default does; dropping one doesn't).

## When something's wrong

| Symptom                                     | Where to look                                                                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Build fails                                 | the application's **Deployment** log; `pnpm install --frozen-lockfile` fails when a lockfile is out of date with its `package.json`                    |
| Container unhealthy                         | `curl https://api.howtobac.ro/v1/health` — `503 {"db":"down"}` means the API is up but can't reach Postgres, so check `DATABASE_URL` and `pg_hba.conf` |
| Pre-deploy step fails on `prisma.config.ts` | change the command to `node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma`, which skips config loading                              |
| 525 from Cloudflare                         | SSL mode is "Flexible"; set **Full (strict)**                                                                                                          |
| CORS errors in the browser console          | `CORS_ORIGINS` is missing the origin actually in the address bar (apex vs `www`)                                                                       |
| Everyone sharing one rate-limit bucket      | `TRUST_PROXY` is too low, so every request looks like it comes from the proxy                                                                          |
| Emails never arrive                         | `MAIL_FROM` isn't on a Resend-verified domain; the API logs the failure and carries on by design                                                       |
| 404 on reloading `/threads/<id>`            | the web container isn't using [nginx.conf](howtobac-frontend/nginx.conf) — its `try_files` is what serves the app shell for dynamic routes             |

Container logs are under each application's **Logs** tab. The API logs through
Nest's logger, so a failed email or a token cleanup run shows up there.

## What Coolify does not cover

- **Database backups.** Coolify's scheduled backups only apply to databases it
  manages, and this one lives outside it. Postgres on .103 keeps whatever backup
  arrangement it already has.
- **Running the test suites.** The build only fails on a compile error, not on a
  failing test; run `pnpm test` and `pnpm test:e2e` before pushing.
