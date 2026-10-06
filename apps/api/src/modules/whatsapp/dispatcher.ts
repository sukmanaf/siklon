import { prisma } from '../../lib/prisma.js';
import { logger } from '../../config/logger.js';
import { jamKeMenit, menitDalamHari, rentangHari, tanggalLokal } from '../../lib/waktu.js';
import { ambil as ambilSetting } from '../settings/settings.service.js';
import { siarkanWa } from '../../realtime/socket.js';
import { GAGAL_PERMANEN } from './provider.js';
import { ambilProvider, jedaAcak, periksaSebelumKirim } from './pengirim.js';

/** Diambil sedikit-sedikit agar satu putaran tidak menahan proses terlalu lama. */
const BATCH = 25;

let sedangJalan = false;
let timer: NodeJS.Timeout | null = null;

/**
 * Jam tenang. Menangani rentang yang melewati tengah malam (18:30–06:00):
 * di kasus itu "di dalam rentang" berarti >= mulai ATAU < selesai.
 */
export function dalamJamTenang(mulai: string, selesai: string, waktu = new Date()): boolean {
  const m = jamKeMenit(mulai);
  const s = jamKeMenit(selesai);
  const kini = menitDalamHari(waktu);
  return m <= s ? kini >= m && kini < s : kini >= m || kini < s;
}

/** Berapa pesan yang sudah benar-benar terkirim hari ini. */
async function terkirimHariIni(): Promise<number> {
  const { awal, akhir } = rentangHari(tanggalLokal());
  return prisma.wa_messages.count({
    where: { status: 'SENT', sent_at: { gte: awal, lt: akhir } },
  });
}

export type HasilPutaran = {
  diproses: number;
  terkirim: number;
  gagal: number;
  ditunda: number;
  alasanTunda?: string;
};

/**
 * Satu putaran pengiriman. Dipanggil berkala (interval sekarang, pg-boss di Fase 6).
 *
 * Urutan pemeriksaannya penting: hal yang membatalkan SELURUH putaran
 * (dimatikan, jam tenang, kuota habis) diperiksa lebih dulu, supaya tidak ada
 * pesan yang percobaannya bertambah sia-sia.
 */
export async function jalankanSatuPutaran(): Promise<HasilPutaran> {
  const kosong: HasilPutaran = { diproses: 0, terkirim: 0, gagal: 0, ditunda: 0 };

  const wa = await ambilSetting('whatsapp');
  if (!wa.aktif) return { ...kosong, alasanTunda: 'Notifikasi WhatsApp dimatikan' };

  if (dalamJamTenang(wa.jam_tenang.mulai, wa.jam_tenang.selesai)) {
    // Pesan dibiarkan di antrean, bukan dibuang — akan terkirim pagi berikutnya.
    const menunggu = await prisma.wa_messages.count({ where: { status: 'QUEUED' } });
    return {
      ...kosong,
      ditunda: menunggu,
      alasanTunda: `Jam tenang ${wa.jam_tenang.mulai}–${wa.jam_tenang.selesai}`,
    };
  }

  const sudah = await terkirimHariIni();
  if (sudah >= wa.maks_per_hari) {
    const menunggu = await prisma.wa_messages.count({ where: { status: 'QUEUED' } });
    logger.warn({ sudah, batas: wa.maks_per_hari }, 'Batas pesan harian tercapai');
    return {
      ...kosong,
      ditunda: menunggu,
      alasanTunda: `Batas harian ${wa.maks_per_hari} pesan sudah tercapai`,
    };
  }

  const sisaKuota = wa.maks_per_hari - sudah;
  const antrean = await prisma.wa_messages.findMany({
    where: { status: 'QUEUED' },
    orderBy: { created_at: 'asc' },
    take: Math.min(BATCH, sisaKuota),
  });

  if (antrean.length === 0) return kosong;

  const provider = ambilProvider();
  if (!provider.siap()) {
    return { ...kosong, ditunda: antrean.length, alasanTunda: 'Provider WhatsApp belum tersambung' };
  }

  const hasil = { ...kosong };

  for (const pesan of antrean) {
    hasil.diproses++;

    const periksa = await periksaSebelumKirim(pesan.phone);
    if (periksa.lewati) {
      // Dilewati karena pengaman, bukan karena gagal kirim. Ditandai SKIPPED
      // lewat status FAILED + alasan yang jelas, supaya tidak dicoba ulang
      // selamanya dan admin tahu sebabnya.
      await prisma.wa_messages.update({
        where: { id: pesan.id },
        data: { status: 'FAILED', last_error: `[dilewati] ${periksa.pesan}`, attempts: { increment: 1 } },
      });
      hasil.gagal++;
      continue;
    }

    const kirim = await provider.kirim(pesan.phone, pesan.body);

    if (kirim.ok) {
      await prisma.wa_messages.update({
        where: { id: pesan.id },
        data: {
          status: 'SENT',
          sent_at: new Date(),
          attempts: { increment: 1 },
          last_error: null,
        },
      });
      hasil.terkirim++;
      if (pesan.student_id) siarkanWa(pesan.student_id, 'SENT');
    } else {
      const percobaan = pesan.attempts + 1;
      const permanen = GAGAL_PERMANEN.includes(kirim.kode);
      const habis = percobaan >= wa.maks_percobaan;

      await prisma.wa_messages.update({
        where: { id: pesan.id },
        data: {
          // Nomor yang tidak terdaftar di WhatsApp tidak akan pernah berhasil;
          // mencoba ulang hanya menghabiskan kuota harian.
          status: permanen || habis ? 'FAILED' : 'QUEUED',
          attempts: percobaan,
          last_error: `[${kirim.kode}] ${kirim.pesan}`,
        },
      });

      if (permanen || habis) {
        hasil.gagal++;
        if (pesan.student_id) siarkanWa(pesan.student_id, 'FAILED');
      }
    }

    // Jeda hanya bila masih ada pesan berikutnya.
    if (hasil.diproses < antrean.length) await jedaAcak();
  }

  if (hasil.diproses > 0) {
    logger.info(hasil, 'Putaran pengiriman WhatsApp selesai');
  }
  return hasil;
}

/** Bungkus agar dua putaran tidak pernah berjalan bersamaan. */
export async function putaranAman(): Promise<HasilPutaran | null> {
  if (sedangJalan) return null;
  sedangJalan = true;
  try {
    return await jalankanSatuPutaran();
  } catch (err) {
    logger.error({ err }, 'Putaran pengiriman WhatsApp gagal');
    return null;
  } finally {
    sedangJalan = false;
  }
}

const INTERVAL_MS = 60_000;

export function mulaiDispatcher() {
  if (timer) return;
  timer = setInterval(() => void putaranAman(), INTERVAL_MS);
  timer.unref();
  logger.info({ intervalDetik: INTERVAL_MS / 1000 }, 'Dispatcher WhatsApp dimulai');
}

export function hentikanDispatcher() {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Ringkasan antrean untuk halaman WhatsApp. */
export async function statusAntrean() {
  const [menunggu, terkirim, gagal, hariIni] = await Promise.all([
    prisma.wa_messages.count({ where: { status: 'QUEUED' } }),
    prisma.wa_messages.count({ where: { status: 'SENT' } }),
    prisma.wa_messages.count({ where: { status: 'FAILED' } }),
    terkirimHariIni(),
  ]);
  const wa = await ambilSetting('whatsapp');

  return {
    menunggu,
    terkirim,
    gagal,
    terkirimHariIni: hariIni,
    batasHarian: wa.maks_per_hari,
    sisaKuota: Math.max(0, wa.maks_per_hari - hariIni),
    dalamJamTenang: dalamJamTenang(wa.jam_tenang.mulai, wa.jam_tenang.selesai),
    jamTenang: wa.jam_tenang,
  };
}
