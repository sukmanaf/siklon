import type { Respons } from '@siklon/shared';

/**
 * Klien API tunggal untuk seluruh frontend.
 *
 * Dua hal yang membuatnya berbeda dari `fetch` telanjang:
 *  1. Membuka bungkus respons seragam `{ ok, data }` / `{ ok, error }` dari API,
 *     jadi pemanggil langsung menerima datanya dan error jadi exception.
 *  2. Menangani 401 di satu tempat — sesi habis di halaman mana pun berakhir
 *     di halaman login, bukan di layar error yang membingungkan.
 */

export const URL_API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export type DetailValidasi = { field: string; pesan: string }[];

export class KesalahanApi extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'KesalahanApi';
  }

  /** Daftar field yang ditolak server (kode VALIDASI_GAGAL). */
  get validasi(): DetailValidasi | null {
    if (this.code !== 'VALIDASI_GAGAL' || !Array.isArray(this.detail)) return null;
    return this.detail as DetailValidasi;
  }
}

/** API mati / jaringan putus. Dibedakan supaya pesannya bisa lebih jelas. */
export class KesalahanJaringan extends Error {
  readonly status = 0;
  readonly code = 'JARINGAN';
  constructor() {
    super('Tidak dapat menghubungi server. Periksa koneksi atau pastikan API sedang berjalan.');
    this.name = 'KesalahanJaringan';
  }
}

type Penangan401 = () => void;

// Diisi oleh Providers saat aplikasi start; sebelum itu dipakai cadangan
// berupa pindah halaman biasa.
let tangani401: Penangan401 | null = null;
export function pasangPenangan401(fn: Penangan401 | null) {
  tangani401 = fn;
}

/**
 * Satu sesi kedaluwarsa biasanya menjatuhkan beberapa permintaan sekaligus.
 * Tanpa penjaga ini, tiap kegagalan memicu pengalihan sendiri-sendiri.
 */
let sedangTangani401 = false;

/**
 * Alamat halaman login untuk sesi yang ditolak.
 *
 * `sesi=habis` bukan hiasan: middleware memakainya sebagai tanda untuk TIDAK
 * memantulkan kembali ke dashboard. Tanpa itu, cookie yang masih ada di
 * browser (tapi sudah tidak berlaku di server) membuat middleware mengira
 * pengguna sudah masuk, dan halaman terjebak memantul bolak-balik.
 */
export function alamatLoginSesiHabis(): string {
  const tujuan = window.location.pathname + window.location.search;
  return `/login?sesi=habis&next=${encodeURIComponent(tujuan)}`;
}

function ke401Default() {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === '/login') return;
  window.location.href = alamatLoginSesiHabis();
}

type OpsiMinta = Omit<RequestInit, 'body'> & {
  /**
   * Objek biasa dikirim sebagai JSON. `FormData` dikirim apa adanya —
   * Content-Type-nya tidak boleh ditulis sendiri karena batas multipart
   * dibuat browser dan akan salah bila header-nya ditimpa.
   */
  body?: unknown;
  /**
   * Matikan penanganan 401 otomatis. Dipakai pengecekan sesi di halaman login,
   * yang justru *mengharapkan* 401 dan tidak boleh memicu pengalihan.
   */
  diamSaat401?: boolean;
};

export async function minta<T>(path: string, opsi: OpsiMinta = {}): Promise<T> {
  const { body, diamSaat401, headers, ...sisa } = opsi;

  const kirimBerkas = body instanceof FormData;

  let res: Response;
  try {
    res = await fetch(`${URL_API}${path}`, {
      ...sisa,
      // Token ada di cookie httpOnly, jadi kredensial wajib ikut dikirim.
      credentials: 'include',
      headers: {
        ...(body === undefined || kirimBerkas ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: kirimBerkas ? body : JSON.stringify(body) }),
    });
  } catch {
    throw new KesalahanJaringan();
  }

  if (res.status === 401 && !diamSaat401) {
    if (!sedangTangani401) {
      sedangTangani401 = true;
      (tangani401 ?? ke401Default)();
    }
  } else if (res.ok) {
    // Permintaan berhasil berarti sesi sehat lagi; penjaga dilepas.
    sedangTangani401 = false;
  }

  // 204 tidak punya body untuk diurai.
  if (res.status === 204) return undefined as T;

  let json: Respons<T>;
  try {
    json = (await res.json()) as Respons<T>;
  } catch {
    throw new KesalahanApi(
      res.status,
      'RESPONS_RUSAK',
      `Server menjawab ${res.status} tanpa isi yang bisa dibaca`,
    );
  }

  if (!json.ok) {
    throw new KesalahanApi(res.status, json.error.code, json.error.message, json.error.detail);
  }
  return json.data;
}

export const api = {
  get: <T>(path: string, opsi?: OpsiMinta) => minta<T>(path, { ...opsi, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opsi?: OpsiMinta) =>
    minta<T>(path, { ...opsi, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, opsi?: OpsiMinta) =>
    minta<T>(path, { ...opsi, method: 'PATCH', body }),
  // PUT punya helper sendiri. Sebelumnya dipakai `patch(..., { method: 'PUT' })`,
  // yang diam-diam tidak berpengaruh: `method` di sini menimpa isi `opsi`,
  // jadi permintaannya tetap terkirim sebagai PATCH dan dijawab 404.
  put: <T>(path: string, body?: unknown, opsi?: OpsiMinta) =>
    minta<T>(path, { ...opsi, method: 'PUT', body }),
  hapus: <T>(path: string, opsi?: OpsiMinta) => minta<T>(path, { ...opsi, method: 'DELETE' }),
};

/** Pesan yang layak ditampilkan ke pengguna dari error apa pun. */
export function pesanError(e: unknown): string {
  if (e instanceof KesalahanApi || e instanceof KesalahanJaringan) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return 'Terjadi kesalahan yang tidak terduga';
}
