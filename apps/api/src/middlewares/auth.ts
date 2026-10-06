import type { RequestHandler } from 'express';
import { prisma } from '../lib/prisma.js';
import { Forbidden, Unauthorized } from '../lib/errors.js';
import { NAMA_COOKIE, bacaToken } from '../lib/jwt.js';
import { ah } from './asyncHandler.js';

/** Ambil token dari cookie (dipakai frontend) atau header Bearer (dipakai alat/test). */
function ambilToken(req: Parameters<RequestHandler>[0]): string | null {
  const dariCookie = (req.cookies as Record<string, string> | undefined)?.[NAMA_COOKIE];
  if (dariCookie) return dariCookie;
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

/**
 * Wajib sudah masuk. Selain memverifikasi tanda tangan JWT, versi token
 * dicocokkan ke database — inilah yang membuat "keluar dari semua perangkat"
 * dan ganti password langsung membatalkan token lama tanpa tabel sesi.
 */
export const wajibMasuk: RequestHandler = ah(async (req, _res, next) => {
  const token = ambilToken(req);
  if (!token) throw Unauthorized();

  const isi = bacaToken(token);
  if (!isi) throw Unauthorized('Sesi tidak valid atau sudah berakhir. Silakan masuk lagi.');

  const user = await prisma.users.findUnique({
    where: { id: isi.sub },
    select: {
      id: true,
      username: true,
      full_name: true,
      role: true,
      is_active: true,
      token_version: true,
      must_change_password: true,
    },
  });

  if (!user) throw Unauthorized('Akun tidak ditemukan');
  if (!user.is_active) throw Forbidden('Akun Anda dinonaktifkan. Hubungi Super Admin.');
  if (user.token_version !== isi.tv) {
    throw Unauthorized('Sesi sudah dibatalkan. Silakan masuk lagi.');
  }

  req.user = {
    id: user.id,
    username: user.username,
    nama: user.full_name,
    peran: user.role,
    wajibGantiPassword: user.must_change_password,
  };
  next();
});

/** Hanya Super Admin. Dipasang setelah `wajibMasuk`. */
export const wajibSuperAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(Unauthorized());
  if (req.user.peran !== 'SUPER_ADMIN') {
    return next(Forbidden('Hanya Super Admin yang dapat mengakses fitur ini'));
  }
  next();
};

/**
 * Menutup seluruh aplikasi bagi pengguna yang belum mengganti password awal.
 * Ditegakkan di API, bukan hanya disembunyikan di frontend — kalau hanya di
 * frontend, mengetik URL langsung tetap tembus.
 *
 * PENTING: wajib dipasang SESUDAH `wajibMasuk`, karena bergantung pada req.user.
 * Kalau dipasang di level app sebelum autentikasi, req.user masih kosong dan
 * middleware ini diam-diam tidak melakukan apa pun.
 */
export const tolakBilaWajibGantiPassword: RequestHandler = (req, _res, next) => {
  if (!req.user) {
    // Dipasang di urutan yang salah. Lebih baik gagal keras daripada
    // memberi rasa aman palsu.
    return next(
      new Error(
        'tolakBilaWajibGantiPassword dipasang sebelum wajibMasuk — periksa urutan middleware',
      ),
    );
  }
  if (!req.user.wajibGantiPassword) return next();
  next(Forbidden('Anda harus mengganti password terlebih dahulu sebelum memakai fitur lain'));
};

/**
 * Rantai standar untuk semua modul terproteksi.
 * Pakai ini, bukan `wajibMasuk` telanjang, supaya penegakan ganti password
 * tidak pernah terlewat saat menambah modul baru.
 */
export const wajibMasukPenuh: RequestHandler[] = [wajibMasuk, tolakBilaWajibGantiPassword];
