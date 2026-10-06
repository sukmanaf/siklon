import jwt from 'jsonwebtoken';
import type { Peran } from '@siklon/shared';
import { env, isProd } from '../config/env.js';

export const NAMA_COOKIE = 'siklon_token';

export type IsiToken = {
  sub: string;
  /** peran, disingkat agar token tetap ringkas */
  rol: Peran;
  /** token version — token dengan versi lama otomatis ditolak */
  tv: number;
};

export function buatToken(isi: IsiToken): string {
  return jwt.sign(isi, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    issuer: 'siklon',
  });
}

/** Mengembalikan null bila token tidak valid atau kedaluwarsa — bukan melempar. */
export function bacaToken(token: string): IsiToken | null {
  try {
    const isi = jwt.verify(token, env.JWT_SECRET, { issuer: 'siklon' });
    if (typeof isi === 'string' || !isi.sub) return null;
    return isi as IsiToken;
  } catch {
    return null;
  }
}

/**
 * httpOnly agar tidak bisa dibaca JavaScript (perlindungan XSS).
 * sameSite lax cukup karena frontend dan API satu domain di produksi.
 */
export const opsiCookie = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/',
  maxAge: 12 * 60 * 60 * 1000,
} as const;
