import { KUNCI_SETTING, SKEMA_SETTING, type KunciSetting } from '@siklon/shared';
import { prisma } from '../../lib/prisma.js';
import { BadRequest, NotFound } from '../../lib/errors.js';
import { logger } from '../../config/logger.js';

/**
 * Cache setting di memori. Endpoint scan dipanggil ratusan kali dalam beberapa
 * menit saat jam masuk; membaca tabel settings setiap kali itu pemborosan.
 * Cache dibuang saat ada perubahan, jadi tidak ada TTL yang bikin nilai basi.
 */
const cache = new Map<string, unknown>();

export function kosongkanCache(kunci?: string) {
  if (kunci) cache.delete(kunci);
  else cache.clear();
}

/** Ambil satu setting yang sudah tervalidasi sesuai skemanya. */
export async function ambil<K extends KunciSetting>(
  kunci: K,
): Promise<ReturnType<(typeof SKEMA_SETTING)[K]['parse']>> {
  if (cache.has(kunci)) return cache.get(kunci) as never;

  const baris = await prisma.settings.findUnique({ where: { key: kunci } });
  if (!baris) throw NotFound(`Setting "${kunci}" belum ada di database. Jalankan seed.sql.`);

  const hasil = SKEMA_SETTING[kunci].safeParse(baris.value);
  if (!hasil.success) {
    // Nilai di database rusak. Ini harus keras terlihat: kalau setting 'presensi'
    // rusak, seluruh penentuan status presensi jadi tidak bisa dipercaya.
    logger.error({ kunci, issues: hasil.error.issues }, 'Nilai setting di database tidak valid');
    throw BadRequest(
      `Setting "${kunci}" di database tidak valid. Perbaiki lewat halaman Pengaturan.`,
      hasil.error.issues,
    );
  }

  cache.set(kunci, hasil.data);
  return hasil.data as never;
}

export async function ambilSemua() {
  const baris = await prisma.settings.findMany();
  const out: Record<string, unknown> = {};
  for (const b of baris) out[b.key] = b.value;
  return out;
}

export async function simpan(kunci: string, nilai: unknown, userId?: string) {
  if (!KUNCI_SETTING.includes(kunci as KunciSetting)) {
    throw BadRequest(
      `Kunci setting "${kunci}" tidak dikenal. Yang tersedia: ${KUNCI_SETTING.join(', ')}`,
    );
  }

  // Validasi SEBELUM menyentuh database. Tanpa ini, nilai salah tersimpan
  // diam-diam dan baru meledak saat dipakai mesin presensi jam 07:00.
  const hasil = SKEMA_SETTING[kunci as KunciSetting].safeParse(nilai);
  if (!hasil.success) {
    throw BadRequest(
      `Nilai setting "${kunci}" tidak valid`,
      hasil.error.issues.map((i) => ({ field: i.path.join('.') || '(root)', pesan: i.message })),
    );
  }

  await prisma.settings.upsert({
    where: { key: kunci },
    update: { value: hasil.data as object, updated_at: new Date() },
    create: { key: kunci, value: hasil.data as object },
  });

  kosongkanCache(kunci);
  logger.info({ kunci, oleh: userId }, 'Setting diperbarui');
  return hasil.data;
}
