# ============================================================
# PresenSee — image web (Next.js)
#
# Tiga tahap supaya image akhir hanya memuat hasil build:
#   deps  — pasang dependensi seluruh workspace (butuh lockfile monorepo)
#   build — build @siklon/shared lalu @siklon/web
#   run   — jalankan keluaran standalone dengan pengguna non-root
#
# Dibangun dari AKAR repo, bukan dari apps/web:
#   docker build -f apps/web/Dockerfile -t presensee-web .
# ============================================================
FROM node:22-alpine AS deps
WORKDIR /repo
RUN corepack enable
# Hanya manifes yang disalin lebih dulu; lapisan ini ikut cache selama
# dependensinya tidak berubah.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
ENV CI=true
RUN pnpm install --frozen-lockfile --filter @siklon/web...

FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY . .
# @siklon/web mengimpor hasil build shared (dist/), bukan sumbernya.
RUN pnpm --filter @siklon/shared build
# URL API ditanam saat build: NEXT_PUBLIC_* ikut ke bundel browser, jadi
# nilainya tidak bisa diubah lagi saat container dijalankan.
ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @siklon/web build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV TZ=Asia/Jakarta

# Jangan jalankan sebagai root.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Keluaran standalone sudah memuat server dan dependensi yang dipakai saja.
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3000

# Health check menembak halaman login karena ia tidak butuh sesi.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
