# syntax=docker/dockerfile:1

# Debian rather than Alpine: argon2 ships prebuilt binaries for glibc, and the
# slim image avoids chasing musl builds for a native dependency.
FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# Uses the pnpm version pinned in package.json's packageManager field.
RUN corepack enable
WORKDIR /app

# Dependencies, cached until the lockfile changes. pnpm-workspace.yaml carries
# the allowBuilds list that lets argon2 and Prisma run their install scripts;
# postinstall generates the Prisma client, which needs the schema but not a
# reachable database (see prisma.config.ts).
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

# What actually runs: the generated client is plain TypeScript under src, so it
# compiles into dist alongside everything else. No query engine to carry.
FROM deps AS build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN pnpm build

# A runtime tree without the test and lint toolchain. `prisma` is a runtime
# dependency on purpose: the deploy runs `prisma migrate deploy` in this image.
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile --prod

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
# Needed by `prisma migrate deploy` at deploy time.
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node prisma.config.ts package.json ./

USER node
EXPOSE 3000

# Reports unhealthy when Postgres is unreachable, not only when Node has died.
# No curl in the image, so ask Node.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD \
  node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
