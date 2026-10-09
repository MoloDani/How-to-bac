# How to Bac — web app

TanStack Start in SPA mode: React 19, TanStack Router and Query, Tailwind 4 with
shadcn/ui, i18next (Romanian by default). See the
[repository README](../README.md) for the project as a whole.

## Setup

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

The dev server proxies `/v1` to `VITE_DEV_API_TARGET` (the deployed API unless
you override it), so the browser only ever talks to one origin and the refresh
cookie works. Point it at `http://127.0.0.1:3000` to develop against a local API.

## Scripts

| Command                                       | What it does                      |
| --------------------------------------------- | --------------------------------- |
| `pnpm dev`                                    | dev server                        |
| `pnpm build`                                  | static bundle into `dist/client/` |
| `pnpm test`                                   | unit and component tests (Vitest) |
| `pnpm typecheck` / `pnpm lint` / `pnpm check` | types, ESLint, Prettier           |
| `pnpm format`                                 | write Prettier and ESLint fixes   |

## Layout

```
src/
  routes/        file-based routes; everything under _app/ needs a session
  components/    shared UI, with shadcn primitives in components/ui/
  lib/api/       fetch client, error codes, response types
  lib/auth/      the session store route guards read
  lib/queries/   TanStack Query options and mutations per feature
  lib/i18n/      i18next setup and the ro/en message catalogues
  lib/permissions.ts   mirrors the API's access rules so the UI only offers
                       what the API will allow
```

## Things to know

- **`VITE_API_URL`** in [.env.production](.env.production) points at
  `https://api.howtobac.ro/v1`, and Vite compiles it into the bundle — so
  changing it means a rebuild. Coolify passes the same variable as a build
  variable, which overrides the file. Anything `VITE_`-prefixed is public.
- **The build is static**, and [Dockerfile](Dockerfile) serves it with nginx —
  `pnpm build` prerenders a shell, [scripts/write-spa-paths.mjs](scripts/write-spa-paths.mjs)
  copies it to each known route, and [nginx.conf](nginx.conf)'s `try_files`
  covers the rest, including dynamic paths like `/threads/<id>`. Deployment is
  Coolify's job: see [DEPLOY.md](../DEPLOY.md).
- **[lib/api/types.ts](src/lib/api/types.ts) mirrors the API's responses by
  hand.** The backend's e2e specs assert those exact payload keys, so the two
  stay in step — change both together.
- **Strings live in [ro.json](src/lib/i18n/locales/ro.json) and
  [en.json](src/lib/i18n/locales/en.json)**, Romanian first. Error codes from the
  API are translated through [lib/api/errors.ts](src/lib/api/errors.ts).
