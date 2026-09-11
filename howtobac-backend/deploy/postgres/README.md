# Connecting to the existing Postgres

The app uses the Postgres container already running on the database server
(`192.168.3.103`, port `5432`). It gets its own login role and databases, and
doesn't touch anything else there.

| What                       | Purpose                                                |
| -------------------------- | ------------------------------------------------------ |
| role `howtobac`            | the app's login — no superuser, can't create databases |
| database `howtobac`        | the app's data                                         |
| database `howtobac_test`   | `pnpm test:e2e` — **wiped on every run**               |
| database `howtobac_shadow` | Prisma's scratch space when creating new migrations    |

Each database keeps its tables in a schema named `howtobac`, which Prisma creates
the first time it runs. Only the `howtobac` role can connect to them.

## 1. Create the role and databases (once)

1. In Adminer, log in as the Postgres superuser and open **SQL command**.
2. Paste [`setup.sql`](setup.sql) and replace `CHANGE_ME` with a long random
   password using only letters and digits (e.g. the output of
   `openssl rand -hex 32`). Save it — it goes into `.env`.
3. Press **Execute**.

If an earlier attempt already created some of these, check what exists and
remove those lines from the script before running it:

```sql
SELECT 'role' AS kind, rolname AS name FROM pg_roles WHERE rolname = 'howtobac'
UNION ALL
SELECT 'database', datname FROM pg_database WHERE datname LIKE 'howtobac%';
```

## 2. Point the app at it

Both the code server (`192.168.3.109`) and your laptop reach Postgres over the
home network with the same URLs. In `howtobac-backend/.env`:

```bash
DATABASE_URL="postgresql://howtobac:<password>@192.168.3.103:5432/howtobac?schema=howtobac"
TEST_DATABASE_URL="postgresql://howtobac:<password>@192.168.3.103:5432/howtobac_test?schema=howtobac"
SHADOW_DATABASE_URL="postgresql://howtobac:<password>@192.168.3.103:5432/howtobac_shadow?schema=howtobac"
```

Then, from `howtobac-backend/`:

```bash
pnpm install     # also generates the Prisma client
pnpm db:deploy   # creates the schema and tables
pnpm db:seed     # creates the first admin — set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD first
```

## 3. Run the API on the code server

In `.env` on `192.168.3.109`, besides the database URLs:

```bash
NODE_ENV=production
PORT=3000
JWT_ACCESS_SECRET=<output of: openssl rand -base64 48>
RESEND_API_KEY=<your Resend key>
MAIL_FROM="How to Bac <noreply@your-domain>"
APP_BASE_URL=<frontend URL>
CORS_ORIGINS=<frontend URL>
COOKIE_SECURE=false   # until the API is served over HTTPS
```

```bash
pnpm build
pnpm start:prod
```

Postgres on `192.168.3.103:5432` is reachable from the whole home network, so
don't forward port 5432 on the router.
