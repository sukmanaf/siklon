import type { StatusPresensi } from '@siklon/shared';

/**
 * Bentuk data yang dikirim API.
 *
 * Nama fieldnya sengaja mengikuti kolom database (`full_name`, `is_active`),
 * bukan diterjemahkan, supaya mudah dicocokkan dengan `database/schema.sql`
 * dan objek `PILIH` di service backend saat menelusuri masalah.
 */

export type KelasRingkas = { id: string; name: string; grade_level: number | null };

export type Siswa = {
  id: string;
  nis: string;
  full_name: string;
  photo_path: string | null;
  is_active: boolean;
  created_at: string;
  classes: KelasRingkas | null;
  /**
   * Wali murid ada langsung di baris siswa, tanpa tabel terpisah.
   * Kakak-adik boleh punya nomor yang sama — itu bukan data dobel.
   */
  guardian_phone: string | null;
  notify: boolean;
};

export type RingkasanSiswa = {
  tahunAjaran: string;
  aktif: number;
  nonaktif: number;
  tanpaKelas: number;
  tanpaWali: number;
  notifikasiMati: number;
};

export type Kelas = {
  id: string;
  academic_year_id: number;
  name: string;
  grade_level: number | null;
  is_active: boolean;
  created_at: string;
  _count: { students: number };
};

export type AnggotaKelas = {
  id: string;
  nis: string;
  full_name: string;
  photo_path: string | null;
  guardian_phone: string | null;
  notify: boolean;
};

export type TahunAjaran = {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
};

export type Libur = { holiday_date: string; name: string };

export type BarisPresensi = {
  id: string;
  /** YYYY-MM-DD, sudah dalam zona Asia/Jakarta. */
  tanggal: string;
  status: StatusPresensi;
  /** HH:MM, null bila status ditandai admin tanpa scan. */
  jamMasuk: string | null;
  /** HH:MM, null bila siswa belum scan pulang. */
  jamPulang: string | null;
  terlambatMenit: number;
  titikScan: string | null;
  catatan: string | null;
};

export type RiwayatSiswa = {
  siswa: { id: string; nis: string; nama: string; kelas: string | null };
  periode: { dari: string; sampai: string };
  ringkasan: {
    hadir: number;
    terlambat: number;
    izin: number;
    sakit: number;
    alpa: number;
    totalMenitTerlambat: number;
  };
  baris: BarisPresensi[];
};

export type MasalahBaris = { baris: number; kolom: string; pesan: string };

export type HasilImport = {
  totalBaris: number;
  siapDiimpor: number;
  jumlahMasalah: number;
  masalah: MasalahBaris[];
  masalahDipotong: boolean;
  tersimpan: boolean;
  pesan: string;
  siswaDibuat?: number;
  siswaDenganWali?: number;
  siswaTanpaWali?: number;
  /** Berapa nomor berbeda di antara siswa yang punya wali (kakak-adik dihitung sekali). */
  nomorWaliUnik?: number;
};

export type HasilPromote = { dari: string; ke: string; jumlah: number }[];

/** Hasil penyalinan kerangka kelas ke tahun ajaran lain. */
export type HasilSalinKelas = {
  tahunAsal: string;
  tahunTujuan: string;
  dibuat: number;
  /** Kelas yang namanya sudah ada di tahun tujuan, jadi tidak digandakan. */
  dilewati: number;
};
