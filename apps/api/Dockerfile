# ============================================================
# PresenSee — image API (Express + Prisma)
#
# Multi-Stage Build untuk Produksi:
#   deps      — pasang seluruh dependensi monorepo untuk kompilasi
#   build     — kompilasi TypeScript @siklon/shared & @siklon/api ke Javascript (dist/)
#   prod-deps — pasang HANYA dependensi produksi (tanpa devDependencies)
#   run       — jalankan server JS (HANYA memuat hasil build dist/, TANPA source code .ts/src)
#
# Dibangun dari AKAR repo:
#   docker build -f apps/api/Dockerfile -t presensee-api .
# ============================================================
FROM node:22-alpine AS deps
WORKDIR /repo
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
ENV CI=true
RUN pnpm install --frozen-lockfile --filter @siklon/api...

FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN pnpm --filter @siklon/shared build
RUN pnpm --filter @siklon/api db:generate
RUN pnpm --filter @siklon/api build

FROM node:22-alpine AS prod-deps
WORKDIR /repo
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
ENV CI=true
RUN pnpm install --frozen-lockfile --prod --filter @siklon/api...

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000
ENV TZ=Asia/Jakarta

RUN apk add --no-cache postgresql-client gzip
RUN addgroup -g 1001 -S nodejs && adduser -S express -u 1001

# Copy HANYA dependensi produksi dan HANYA file JavaScript hasil build (dist/)
# Sama sekali TIDAK menyalin folder src/, file .ts, atau source code mentah
COPY --from=prod-deps --chown=express:nodejs /repo/node_modules ./node_modules
COPY --from=prod-deps --chown=express:nodejs /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=express:nodejs /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=build --chown=express:nodejs /repo/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=express:nodejs /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=express:nodejs /repo/apps/api/dist ./apps/api/dist

USER express
EXPOSE 5000

CMD ["node", "apps/api/dist/server.js"]
