# syntax=docker/dockerfile:1

FROM node:24-slim AS build
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# Vite compiles this into the bundle, so it has to be known now rather than at
# container start. Coolify passes it as a build variable; .env.production holds
# the default. Changing it means rebuilding, not restarting.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm build

FROM nginx:alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/client /usr/share/nginx/html
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD \
  wget -q --spider http://127.0.0.1/ || exit 1
