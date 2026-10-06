import {
  CalendarCheckIcon,
  CalendarDaysIcon,
  LayoutDashboardIcon,
  LayoutGridIcon,
  MessageCircleIcon,
  ScanLineIcon,
  SettingsIcon,
  ShieldUserIcon,
  UsbIcon,
  UsersRoundIcon,
} from 'lucide-react';
import type { Peran } from '@siklon/shared';

export type ItemNav = {
  href: string;
  label: string;
  Ikon: typeof LayoutDashboardIcon;
  /** Label kecil di ujung kanan, seperti pada mockup. */
  pil?: { teks: string; gaya: 'merah' | 'ungu' };
  /** Hanya peran ini yang melihat menunya. Kosong = semua peran. */
  hanyaPeran?: Peran;
  /**
   * Halaman ini sudah ada. Menu yang belum siap tetap ditampilkan supaya
   * peta aplikasi terlihat utuh, tapi tidak bisa diklik — lebih jujur
   * daripada menu yang mengantar ke halaman 404.
   */
  siap: boolean;
};

export type GrupNav = { judul: string; item: ItemNav[] };

export const NAVIGASI: GrupNav[] = [
  {
    judul: 'Utama',
    item: [
      { href: '/dashboard', label: 'Dashboard', Ikon: LayoutDashboardIcon, siap: true },
      {
        href: '/scan',
        label: 'Konsol Scan',
        Ikon: ScanLineIcon,
        pil: { teks: 'LIVE', gaya: 'merah' },
        siap: true,
      },
    ],
  },
  {
    judul: 'Master Data',
    item: [
      { href: '/siswa', label: 'Siswa', Ikon: UsersRoundIcon, siap: true },
      { href: '/kelas', label: 'Kelas', Ikon: LayoutGridIcon, siap: true },
      // Menu "Wali Murid" sengaja tidak ada: wali tidak dikelola sebagai data
      // tersendiri, hanya nomor HP-nya yang menempel di data siswa (FE-018).
    ],
  },
  {
    judul: 'Presensi',
    item: [
      { href: '/kelola-presensi', label: 'Kelola Presensi', Ikon: CalendarCheckIcon, siap: true },
      { href: '/laporan/harian', label: 'Laporan Harian', Ikon: CalendarCheckIcon, siap: true },
      { href: '/laporan/bulanan', label: 'Laporan Bulanan', Ikon: CalendarDaysIcon, siap: true },
    ],
  },
  {
    judul: 'Sistem',
    item: [
      { href: '/scanner', label: 'Scanner', Ikon: UsbIcon, siap: true },
      { href: '/whatsapp', label: 'WhatsApp', Ikon: MessageCircleIcon, siap: true },
      { href: '/pengaturan', label: 'Pengaturan', Ikon: SettingsIcon, siap: true },
      {
        href: '/pengguna',
        label: 'Pengguna',
        Ikon: ShieldUserIcon,
        pil: { teks: 'SA', gaya: 'ungu' },
        hanyaPeran: 'SUPER_ADMIN',
        siap: true,
      },
    ],
  },
];

/**
 * Menu yang boleh dilihat sebuah peran.
 *
 * Penting: ini murni kosmetik. Backend tetap menolak permintaan yang tidak
 * berhak dengan 403 — lihat `wajibSuperAdmin` di apps/api (FE-011).
 */
export function navigasiUntuk(peran: Peran | undefined): GrupNav[] {
  return NAVIGASI.map((g) => ({
    ...g,
    item: g.item.filter((i) => !i.hanyaPeran || i.hanyaPeran === peran),
  })).filter((g) => g.item.length > 0);
}

/** Judul dan sub-judul topbar per rute. */
export const JUDUL_HALAMAN: Record<string, { judul: string; sub?: string }> = {
  '/dashboard': { judul: 'Dashboard' },
  '/siswa': { judul: 'Siswa' },
  '/siswa/import': { judul: 'Import Siswa', sub: 'unggah berkas Excel' },
  '/kelas': { judul: 'Kelas' },
  '/scan': { judul: 'Konsol Scan', sub: 'layar petugas gerbang' },
  '/scanner': { judul: 'Scanner', sub: 'kamera & pemindai serial' },
  '/whatsapp': { judul: 'WhatsApp', sub: 'koneksi, template, log, dan pengaturan kirim' },
  '/kelola-presensi': { judul: 'Kelola Presensi' },
  '/laporan/harian': { judul: 'Laporan Harian' },
  '/laporan/bulanan': { judul: 'Laporan Bulanan' },
  '/pengaturan': { judul: 'Pengaturan', sub: 'Jadwal, hari libur, tahun ajaran, identitas sekolah' },
  '/pengguna': { judul: 'Pengguna', sub: 'Khusus Super Admin' },
  '/tidak-punya-akses': { judul: 'Tidak punya akses' },
};

/** Judul untuk rute berparameter, dicocokkan dengan awalan path. */
export const JUDUL_AWALAN: { awalan: string; judul: string; sub?: string }[] = [
  { awalan: '/siswa/', judul: 'Detail Siswa' },
];
