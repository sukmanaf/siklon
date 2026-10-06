/** Bentuk respons seragam untuk seluruh endpoint. */
export type Sukses<T> = { ok: true; data: T };
export type Gagal = { ok: false; error: { code: string; message: string; detail?: unknown } };
export type Respons<T> = Sukses<T> | Gagal;

export type Halaman<T> = {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPage: number;
};

/** Hasil satu scan yang dikirim ke Konsol Scan (lewat HTTP maupun Socket.IO). */
export type HasilScan = {
  ok: boolean;
  kode?: string;
  pesan: string;
  /**
   * Scan ini dicatat sebagai apa. 'PULANG' hanya muncul untuk siswa yang sudah
   * punya jam masuk hari itu dan scan lagi pada/sesudah jam pulang.
   */
  jenis?: 'MASUK' | 'PULANG';
  /** Jam pulang yang tercatat, bila scan ini adalah scan pulang. */
  jamPulang?: string | null;
  jam: string;
  /**
   * Kode titik scan, mis. 'GERBANG-1'. Null bila scannya tidak berasal dari
   * titik tertentu — scan lewat kamera di browser tidak dicatat asalnya,
   * karena sistem ini memang tidak perlu tahu siswa absen lewat mana.
   */
  titikScan: string | null;
  siswa?: {
    id: string;
    nis: string;
    nama: string;
    kelas: string | null;
    fotoUrl: string | null;
  };
  status?: 'HADIR' | 'TERLAMBAT';
  terlambatMenit?: number;
  waDiantrekan?: boolean;
};
