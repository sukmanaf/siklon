import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/lib/password.js';

describe('password', () => {
  it('hash berformat argon2id', async () => {
    const h = await hashPassword('rahasia123');
    expect(h.startsWith('$argon2id$')).toBe(true);
  });

  it('password benar lolos, password salah gagal', async () => {
    const h = await hashPassword('rahasia123');
    expect(await verifyPassword(h, 'rahasia123')).toBe(true);
    expect(await verifyPassword(h, 'rahasia124')).toBe(false);
  });

  it('dua hash dari password sama harus berbeda (salt acak)', async () => {
    expect(await hashPassword('sama')).not.toBe(await hashPassword('sama'));
  });

  it('hash placeholder dari seed.sql tidak membuat crash, hanya gagal', async () => {
    // Ini penting: seed.sql memuat hash placeholder. Kalau verify melempar,
    // login akan jadi 500 alih-alih "password salah".
    const rusak = '$argon2id$v=19$m=19456,t=2,p=1$GANTI_DENGAN_HASH_ASLI';
    await expect(verifyPassword(rusak, 'apa pun')).resolves.toBe(false);
    await expect(verifyPassword('bukan hash', 'apa pun')).resolves.toBe(false);
  });
});
