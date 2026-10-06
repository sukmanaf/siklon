import { describe, expect, it } from 'vitest';
import { formatNomor, normalkanNomor, samarkanNomor } from '@siklon/shared';

describe('normalkanNomor', () => {
  it('semua variasi penulisan nomor yang sama menghasilkan hasil identik', () => {
    const target = '6281234567890';
    for (const v of [
      '081234567890',
      '0812-3456-7890',
      '0812 3456 7890',
      '(0812) 34567890',
      '+6281234567890',
      '+62 812 3456 7890',
      '6281234567890',
      '81234567890',
    ]) {
      expect(normalkanNomor(v), `gagal pada "${v}"`).toBe(target);
    }
  });

  it('menolak yang bukan nomor telepon', () => {
    for (const v of ['', 'abc', '0812-abcd-7890', '08', '0', '628123456789012345']) {
      expect(normalkanNomor(v), `seharusnya null: "${v}"`).toBeNull();
    }
  });
});

describe('tampilan nomor', () => {
  it('samarkan menyembunyikan bagian tengah', () => {
    expect(samarkanNomor('6281234567890')).toBe('0812****7890');
  });
  it('format enak dibaca', () => {
    expect(formatNomor('6281234567890')).toBe('0812-3456-7890');
  });
});
