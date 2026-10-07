import { z } from 'zod';
import { KEJADIAN_WA } from './constants.js';

const jam = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format jam harus HH:MM, contoh 07:00');

/** Kunci 'presensi' — aturan jam masuk dan penentuan status. */
export const skemaPresensi = z.object({
  jam_masuk: jam,
  toleransi_menit: z.number().int().min(0).max(120),
  batas_alpa: jam,
  /**
   * Jam pulang. Scan pada atau sesudah jam ini — untuk siswa yang sudah punya
   * jam masuk — dicatat sebagai absen pulang, bukan ditolak sebagai "sudah absen".
   */
  jam_pulang: jam,
  /** Batas akhir menolak scan masuk. (Opsional, kosong = tidak ada batas) */
  batas_akhir_masuk: jam.optional().nullable(),
  /** Batas akhir menolak scan pulang. (Opsional, kosong = tidak ada batas) */
  batas_akhir_pulang: jam.optional().nullable(),
  /** 0=Minggu … 6=Sabtu */
  hari_sekolah: z.array(z.number().int().min(0).max(6)).min(1),
  /** Override per hari; hanya kunci yang ditulis yang menimpa nilai utama. */
  khusus: z
    .record(
      z.string().regex(/^[0-6]$/),
      z.object({
        jam_masuk: jam.optional(),
        toleransi_menit: z.number().int().min(0).max(120).optional(),
        batas_alpa: jam.optional(),
        jam_pulang: jam.optional(),
        batas_akhir_masuk: jam.optional().nullable(),
        batas_akhir_pulang: jam.optional().nullable(),
      }),
    )
    .default({}),
});
export type Presensi = z.infer<typeof skemaPresensi>;

export const skemaSekolah = z.object({
  nama: z.string().min(1),
  alamat: z.string().default(''),
  kepala_sekolah: z.string().default(''),
});
export type Sekolah = z.infer<typeof skemaSekolah>;

export const skemaScan = z.object({
  debounce_detik: z.number().int().min(0).max(3600),
  tampilkan_foto: z.boolean(),
  bunyi: z.boolean(),
});
export type Scan = z.infer<typeof skemaScan>;

export const skemaWhatsapp = z
  .object({
    aktif: z.boolean(),
    provider: z.enum(['dummy', 'baileys']),
    jeda_min_ms: z.number().int().min(0),
    jeda_max_ms: z.number().int().min(0),
    maks_per_hari: z.number().int().min(0),
    maks_percobaan: z.number().int().min(1).max(10),
    jam_tenang: z.object({ mulai: jam, selesai: jam }),
    kirim_saat: z.array(z.enum(KEJADIAN_WA)),
    rekap_mingguan: z.boolean().default(false),
  })
  .refine((v) => v.jeda_max_ms >= v.jeda_min_ms, {
    message: 'jeda_max_ms tidak boleh lebih kecil dari jeda_min_ms',
    path: ['jeda_max_ms'],
  });
export type Whatsapp = z.infer<typeof skemaWhatsapp>;

export const skemaTemplateWa = z.record(z.enum(KEJADIAN_WA), z.string().min(1));
export type TemplateWa = z.infer<typeof skemaTemplateWa>;

/** Satu titik scan: scanner serial atau kamera. */
export const skemaScanner = z.object({
  /** Kunci stabil: 'SN:<seri>' | 'USB:<lokasi>' | 'PORT:<com>' | 'CAM:<deviceId>' */
  id: z.string().min(1),
  tipe: z.enum(['SERIAL', 'KAMERA']),
  kode: z.string().min(1).max(20),
  label: z.string().min(1),
  aktif: z.boolean().default(true),
});
export const skemaScanners = z.array(skemaScanner);
export type Scanner = z.infer<typeof skemaScanner>;

/**
 * Peta kunci settings ke skema validasinya.
 * Dipakai GET/PUT /settings agar nilai tidak valid ditolak, bukan tersimpan diam-diam.
 */
export const SKEMA_SETTING = {
  presensi: skemaPresensi,
  sekolah: skemaSekolah,
  scan: skemaScan,
  whatsapp: skemaWhatsapp,
  template_wa: skemaTemplateWa,
  scanners: skemaScanners,
} as const;

export type KunciSetting = keyof typeof SKEMA_SETTING;
export const KUNCI_SETTING = Object.keys(SKEMA_SETTING) as KunciSetting[];
