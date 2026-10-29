import { join } from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @siklon/shared dikirim sebagai ESM hasil build tsc, bukan bundel siap pakai.
  transpilePackages: ['@siklon/shared'],
  eslint: { ignoreDuringBuilds: true },

  /**
   * Keluaran mandiri untuk Docker: Next menyalin hanya berkas server dan
   * dependensi yang benar-benar dipakai ke .next/standalone, jadi image tidak
   * perlu memuat seluruh node_modules monorepo.
   */
  output: 'standalone',
  // Monorepo: tanpa ini Next menebak akar dari lokasi lockfile terdekat dan
  // bisa salah menyalin berkas saat dijalankan dari dalam apps/web.
  outputFileTracingRoot: join(import.meta.dirname, '../..'),

  /**
   * Halaman ini tidak pernah memakai komponen <Image> (dicek: tidak ada satu
   * pun import next/image), jadi optimisasi gambar bawaan Next tidak
   * berguna di sini.
   */
  images: { unoptimized: true },

  /**
   * `images.unoptimized` SAJA TERNYATA TIDAK CUKUP — Next tetap menelusuri
   * (trace) `sharp` ke dalam .next/standalone walau tidak dipakai runtime
   * (diverifikasi langsung: masih ada node_modules/.pnpm/sharp@... setelah
   * unoptimized diaktifkan). `sharp` punya binary native per-OS
   * (`@img/sharp-linux-x64`) — kalau dibangun di Linux lalu dijalankan di
   * Windows (paket deploy native), ini akan gagal kalau pernah terpanggil.
   * Dikecualikan eksplisit di sini supaya benar-benar tidak ikut terbawa.
   */
  outputFileTracingExcludes: {
    '*': ['**/node_modules/sharp/**', '**/node_modules/@img/**'],
  },

  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:4000/api/v1/:path*',
      },
      {
        source: '/socket.io/:path*',
        destination: 'http://localhost:4000/socket.io/:path*',
      },
    ];
  },
};

export default nextConfig;
