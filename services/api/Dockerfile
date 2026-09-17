# syntax=docker/dockerfile:1.7
# Build from the repository root:  docker build -f services/api/Dockerfile -t stocktank-api .

# ---------- base: Node 24 + pnpm via corepack ----------
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
WORKDIR /repo

# ---------- build: install workspace deps, generate Prisma client, compile ----------
FROM base AS build
# argon2 / prisma engines may need to compile or download native pieces
RUN apk add --no-cache python3 make g++ libc6-compat
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/types ./packages/types
COPY packages/config ./packages/config
COPY packages/database ./packages/database
COPY packages/media ./packages/media
COPY services/api ./services/api
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @stocktank/api...
RUN pnpm --filter @stocktank/database generate \
 && pnpm --filter @stocktank/types build \
 && pnpm --filter @stocktank/config build \
 && pnpm --filter @stocktank/database build \
 && pnpm --filter @stocktank/api build
# Self-contained production tree for the API (workspace packages + prod node_modules only)
RUN pnpm --filter @stocktank/api deploy --prod --legacy /out

# ---------- runtime: minimal, non-root ----------
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
ENV API_PORT=4000
ARG GIT_COMMIT=""
ENV GIT_COMMIT=$GIT_COMMIT
RUN apk add --no-cache wget \
 && addgroup -S stocktank && adduser -S -G stocktank stocktank
WORKDIR /app
COPY --from=build --chown=stocktank:stocktank /out/dist ./dist
COPY --from=build --chown=stocktank:stocktank /out/node_modules ./node_modules
COPY --from=build --chown=stocktank:stocktank /out/package.json ./package.json
USER stocktank
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${API_PORT}/health" >/dev/null || exit 1
CMD ["node", "dist/server.js"]
