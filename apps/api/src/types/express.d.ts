import type { Peran } from '@siklon/shared';

declare global {
  namespace Express {
    interface Request {
      /** Diisi middleware `wajibMasuk`. Tidak ada = permintaan belum terautentikasi. */
      user?: {
        id: string;
        username: string;
        nama: string;
        peran: Peran;
        wajibGantiPassword: boolean;
      };
    }
  }
}

export {};
