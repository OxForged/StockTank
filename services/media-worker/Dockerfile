# syntax=docker/dockerfile:1.7
# Build from the repository root:  docker build -f services/media-worker/Dockerfile -t stocktank-media-worker .

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
WORKDIR /repo

FROM base AS build
RUN apk add --no-cache python3 make g++ libc6-compat
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/types ./packages/types
COPY packages/database ./packages/database
COPY packages/media ./packages/media
COPY services/media-worker ./services/media-worker
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @stocktank/media-worker...
# prisma.config.ts requires DATABASE_URL; generate never connects, so a placeholder is enough at build time.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm --filter @stocktank/database generate \
 && pnpm --filter @stocktank/types build \
 && pnpm --filter @stocktank/database build \
 && pnpm --filter @stocktank/media build \
 && pnpm --filter @stocktank/media-worker build
# Production tree only: ffmpeg-static is a dev dependency; the runtime uses the distro FFmpeg below.
RUN pnpm --filter @stocktank/media-worker deploy --prod --legacy /out

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV FFPROBE_PATH=/usr/bin/ffprobe
ENV MEDIA_WORK_DIR=/work
ARG GIT_COMMIT=""
ENV GIT_COMMIT=$GIT_COMMIT
RUN apk add --no-cache ffmpeg \
 && addgroup -S stocktank && adduser -S -G stocktank stocktank \
 && mkdir -p /work && chown stocktank:stocktank /work
WORKDIR /app
COPY --from=build --chown=stocktank:stocktank /out/dist ./dist
COPY --from=build --chown=stocktank:stocktank /out/node_modules ./node_modules
COPY --from=build --chown=stocktank:stocktank /out/package.json ./package.json
USER stocktank
# Scratch space for originals and renditions while a job runs; size it for the largest expected upload x ~3.
VOLUME ["/work"]
CMD ["node", "dist/worker.js"]
