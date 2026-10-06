import { DatabaseSync } from 'node:sqlite';
import { log } from './log.js';

/**
 * Antrean offline. Memakai `node:sqlite` bawaan Node — tanpa dependensi
 * eksternal, jadi pemasangan di PC sekolah tidak perlu compiler apa pun.
 *
 * Kenapa harus tahan mati listrik: PC gerbang sekolah biasanya tanpa UPS.
 * Kalau antreannya cuma di memori, scan yang belum terkirim akan hilang
 * begitu listrik mati — dan siswa yang sudah masuk tercatat alpa.
 */
export type ScanTertunda = {
  id: number;
  nis: string;
  portPath: string;
  /**
   * Kode gerbang yang berlaku SAAT scan terjadi.
   *
   * Disimpan di sini, bukan dibiarkan diterjemahkan server nanti: server
   * memetakan path ke kode dari daftar port di memori, dan daftar itu kosong
   * setelah server restart. Tanpa kode di sini, semua scan susulan setelah
   * server mati akan kehilangan info gerbangnya — justru saat paling dibutuhkan.
   */
  kode: string;
  scannedAt: string;
  percobaan: number;
};

export class Antrean {
  private db: DatabaseSync;

  constructor(berkas: string) {
    this.db = new DatabaseSync(berkas);

    // WAL: tulis tetap aman saat proses mati mendadak, dan pembacaan tidak
    // terblokir oleh penulisan.
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA synchronous = FULL');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS antrean (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        nis        TEXT    NOT NULL,
        port_path  TEXT    NOT NULL,
        kode       TEXT    NOT NULL DEFAULT '',
        scanned_at TEXT    NOT NULL,
        percobaan  INTEGER NOT NULL DEFAULT 0,
        error      TEXT,
        dibuat_at  TEXT    NOT NULL DEFAULT (datetime('now'))
      )
    `);
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_antrean_id ON antrean(id)');

    // Berkas antrean dari versi agent sebelumnya belum punya kolom ini.
    try {
      this.db.exec("ALTER TABLE antrean ADD COLUMN kode TEXT NOT NULL DEFAULT ''");
    } catch {
      /* kolomnya sudah ada */
    }
  }

  tambah(nis: string, portPath: string, kode: string, scannedAt: string): number {
    const st = this.db.prepare(
      'INSERT INTO antrean (nis, port_path, kode, scanned_at) VALUES (?, ?, ?, ?)',
    );
    const hasil = st.run(nis, portPath, kode, scannedAt);
    return Number(hasil.lastInsertRowid);
  }

  ambil(batas = 200): ScanTertunda[] {
    const baris = this.db
      .prepare(
        'SELECT id, nis, port_path AS portPath, kode, scanned_at AS scannedAt, percobaan ' +
          'FROM antrean ORDER BY id LIMIT ?',
      )
      .all(batas) as unknown as ScanTertunda[];
    return baris;
  }

  /**
   * Hapus setelah server MENERIMA, bukan setelah server menjawab "ok".
   *
   * Scan yang ditolak (NIS tidak terdaftar, hari libur, sudah absen) tetap
   * dihapus: server sudah memutuskan, dan menyimpannya hanya membuat antrean
   * mencoba ulang selamanya sesuatu yang tidak akan pernah berubah.
   */
  hapus(ids: number[]): void {
    if (ids.length === 0) return;
    const tanya = ids.map(() => '?').join(',');
    this.db.prepare(`DELETE FROM antrean WHERE id IN (${tanya})`).run(...ids);
  }

  tandaiGagal(ids: number[], pesan: string): void {
    if (ids.length === 0) return;
    const tanya = ids.map(() => '?').join(',');
    this.db
      .prepare(`UPDATE antrean SET percobaan = percobaan + 1, error = ? WHERE id IN (${tanya})`)
      .run(pesan.slice(0, 300), ...ids);
  }

  jumlah(): number {
    const r = this.db.prepare('SELECT COUNT(*) AS n FROM antrean').get() as { n: number };
    return Number(r.n);
  }

  /**
   * Buang antrean yang sudah terlalu lama dicoba. Batas 50 percobaan dengan
   * selang 15 detik berarti sudah lebih dari 12 menit — kalau masih gagal,
   * masalahnya bukan koneksi sesaat.
   */
  bersihkanMacet(maksPercobaan = 50): number {
    const r = this.db.prepare('DELETE FROM antrean WHERE percobaan >= ?').run(maksPercobaan);
    const n = Number(r.changes);
    if (n > 0) log.warn(`${n} scan dibuang dari antrean karena gagal ${maksPercobaan}x berturut-turut`);
    return n;
  }

  tutup(): void {
    this.db.close();
  }
}
