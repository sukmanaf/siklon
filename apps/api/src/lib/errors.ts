/**
 * Error aplikasi yang punya kode dan status HTTP.
 * Hanya error jenis ini yang pesannya ditampilkan ke pengguna;
 * error lain diringkas jadi 500 tanpa membocorkan detail internal.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const BadRequest = (message: string, detail?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, detail);

export const Unauthorized = (message = 'Anda belum masuk atau sesi sudah berakhir') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const Forbidden = (message = 'Anda tidak memiliki akses ke fitur ini') =>
  new AppError(403, 'FORBIDDEN', message);

export const NotFound = (message = 'Data tidak ditemukan') =>
  new AppError(404, 'NOT_FOUND', message);

export const Conflict = (message: string, detail?: unknown) =>
  new AppError(409, 'CONFLICT', message, detail);

export const TooMany = (message = 'Terlalu banyak percobaan. Coba lagi nanti.') =>
  new AppError(429, 'TOO_MANY_REQUESTS', message);
