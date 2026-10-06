import { hash, verify } from '@node-rs/argon2';

/** Parameter Argon2id sesuai anjuran OWASP: 19 MiB, 2 iterasi, paralel 1. */
const OPSI = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (password: string) => hash(password, OPSI);

/**
 * Verifikasi password. Sengaja mengembalikan false (bukan melempar) bila hash
 * di database rusak/placeholder, supaya login gagal wajar tanpa 500.
 */
export async function verifyPassword(hashTersimpan: string, password: string): Promise<boolean> {
  try {
    return await verify(hashTersimpan, password);
  } catch {
    return false;
  }
}
