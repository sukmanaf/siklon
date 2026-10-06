import { normalkanNomor } from '@siklon/shared';
import { env, isProd } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { ambil as ambilSetting } from '../settings/settings.service.js';
import { BaileysProvider } from './baileys.provider.js';
import { DummyProvider, type HasilKirim, type WaProvider } from './provider.js';

let provider: WaProvider | null = null;

/**
 * Nomor yang boleh menerima pesan saat bukan production.
 *
 * Dinormalkan saat dibaca supaya boleh ditulis 08xxx, +62xxx, maupun 62xxx.
 * Perbandingannya nanti melawan nomor yang SUDAH dinormalkan; kalau daftar ini
 * dibiarkan mentah, menulis 0812… tidak akan pernah cocok dengan 62812… dan
 * SEMUA pengiriman ditolak sebagai DILUAR_ALLOWLIST — tanpa petunjuk bahwa
 * yang salah cuma format penulisannya.
 */
const entriAllowlist = env.WA_ALLOWLIST.split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * `WA_ALLOWLIST=*` mematikan pagar penerima.
 *
 * Disediakan supaya uji coba di mesin pengembangan tidak perlu menyunting
 * `.env` tiap ganti nomor tujuan. Sengaja berupa nilai khusus yang harus
 * DITULIS, bukan dengan menghapus pemeriksaannya: daftar kosong tetap berarti
 * "tolak semua", jadi keadaan bawaannya masih gagal ke arah aman, dan
 * mematikannya jadi keputusan yang terlihat — ikut tercetak di spanduk
 * peringatan halaman WhatsApp.
 */
const semuaNomorBoleh = entriAllowlist.includes('*');

const allowlist = entriAllowlist
  .filter((s) => s !== '*')
  .map((mentah) => {
    const rapi = normalkanNomor(mentah);
    if (!rapi) {
      logger.warn({ entri: mentah }, 'Entri WA_ALLOWLIST bukan nomor Indonesia yang valid — diabaikan');
    }
    return rapi;
  })
  .filter((n): n is string => n !== null);

/**
 * Provider ditentukan oleh `WA_PROVIDER` di environment, BUKAN oleh setelan
 * di database.
 *
 * Ini disengaja sebagai pengaman keras: setelan di halaman Pengaturan bisa
 * salah klik, dan pada instalasi baru data contohnya berisi nomor karangan
 * yang formatnya valid. Kalau setelan database yang menentukan, satu klik
 * salah cukup untuk mengirimi orang asing pesan tentang anak yang bukan anaknya.
 * Menyalakan pengiriman sungguhan harus butuh akses ke server.
 */
export function ambilProvider(): WaProvider {
  if (provider) return provider;
  provider = env.WA_PROVIDER === 'baileys' ? new BaileysProvider() : new DummyProvider();
  logger.info({ provider: provider.nama }, 'Provider WhatsApp disiapkan');
  return provider;
}

export type AlasanDilewati =
  | { lewati: false }
  | { lewati: true; kode: string; pesan: string };

/**
 * Tiga lapis pemeriksaan sebelum satu pesan benar-benar dikirim.
 * Semuanya bisa membatalkan pengiriman, dan alasannya dicatat di log pesan.
 */
export async function periksaSebelumKirim(nomor: string): Promise<AlasanDilewati> {
  const wa = await ambilSetting('whatsapp');

  if (!wa.aktif) {
    return { lewati: true, kode: 'WA_DIMATIKAN', pesan: 'Notifikasi WhatsApp dimatikan di Pengaturan' };
  }

  const p = ambilProvider();

  // Pengaman allowlist hanya berlaku di luar production, dan HANYA untuk
  // provider yang benar-benar mengirim. Dummy tidak perlu dibatasi.
  if (!isProd && p.nama === 'baileys' && !semuaNomorBoleh) {
    if (allowlist.length === 0) {
      return {
        lewati: true,
        kode: 'ALLOWLIST_KOSONG',
        pesan:
          'DITOLAK: provider baileys aktif di lingkungan non-production tapi WA_ALLOWLIST kosong. ' +
          'Isi WA_ALLOWLIST dengan nomor uji Anda sendiri sebelum mengirim.',
      };
    }
    if (!allowlist.includes(nomor)) {
      return {
        lewati: true,
        kode: 'DILUAR_ALLOWLIST',
        pesan: `Nomor ${nomor} tidak ada di WA_ALLOWLIST — dilewati agar tidak mengirim ke orang sungguhan`,
      };
    }
  }

  return { lewati: false };
}

/** Jeda acak antar pesan. Pola pengiriman yang seragam paling cepat dianggap spam. */
export async function jedaAcak(): Promise<number> {
  const wa = await ambilSetting('whatsapp');
  const ms = wa.jeda_min_ms + Math.floor(Math.random() * (wa.jeda_max_ms - wa.jeda_min_ms + 1));
  await new Promise((r) => setTimeout(r, ms));
  return ms;
}

export async function kirimSatu(nomor: string, isi: string): Promise<HasilKirim> {
  const periksa = await periksaSebelumKirim(nomor);
  if (periksa.lewati) {
    logger.warn({ nomor, kode: periksa.kode }, periksa.pesan);
    return {
      ok: false,
      kode: periksa.kode === 'DILUAR_ALLOWLIST' ? 'DILUAR_ALLOWLIST' : 'DIBATASI_PROVIDER',
      pesan: periksa.pesan,
    };
  }
  return ambilProvider().kirim(nomor, isi);
}

/**
 * Menyambung ulang saat server start — dengan tiga syarat.
 *
 * Awalnya server SENGAJA tidak pernah menyambung sendiri, supaya restart tidak
 * memulai pengiriman tanpa sepengetahuan siapa pun. Niat itu dipertahankan,
 * hanya syaratnya dipersempit:
 *
 *  1. Provider yang punya sesi (baileys). Dummy tidak perlu menyambung.
 *  2. Sudah ada sesi tersimpan. Tanpa ini, menyambung otomatis hanya akan
 *     menerbitkan QR pairing yang tidak dilihat siapa pun.
 *  3. Notifikasi memang sedang dinyalakan admin. Kalau `aktif` false, server
 *     tetap diam seperti sebelumnya.
 *
 * Ketiganya berarti: yang dipulihkan hanyalah sambungan yang tadinya memang
 * sudah dinyalakan secara sadar. Tanpa ini, satu restart membuat WhatsApp diam
 * sampai ada admin yang kebetulan membuka halaman dan menekan Sambungkan —
 * sementara notifikasi kedatangan menumpuk di antrean tanpa ada yang sadar.
 */
export async function sambungkanUlangBilaPerlu(): Promise<void> {
  const p = ambilProvider();
  if (!p.punyaSesi) return;
  if (!(await p.punyaSesi())) {
    logger.info('Belum ada sesi WhatsApp tersimpan — menunggu admin memindai QR');
    return;
  }

  const wa = await ambilSetting('whatsapp');
  if (!wa.aktif) {
    logger.info('Sesi WhatsApp ada tapi notifikasi dimatikan di Pengaturan — tidak menyambung');
    return;
  }

  try {
    await p.sambungkan();
    logger.info('Sesi WhatsApp disambungkan ulang otomatis sesudah server start');
  } catch (err) {
    // Gagal menyambung tidak boleh menggagalkan start server: presensinya
    // sendiri masih harus jalan penuh tanpa WhatsApp.
    logger.error({ err }, 'Gagal menyambung ulang WhatsApp saat start');
  }
}

/** Untuk halaman WhatsApp: menerangkan mengapa pengiriman mati/hidup. */
export function ringkasanPengaman() {
  return {
    providerEnv: env.WA_PROVIDER,
    production: isProd,
    allowlistAktif: !isProd && env.WA_PROVIDER === 'baileys' && !semuaNomorBoleh,
    jumlahAllowlist: allowlist.length,
    catatan:
      env.WA_PROVIDER === 'dummy'
        ? 'WA_PROVIDER=dummy — tidak ada pesan yang benar-benar dikirim, apa pun setelan di database.'
        : !isProd && semuaNomorBoleh
          ? 'WA_ALLOWLIST=* — pagar penerima DIMATIKAN. Pesan bisa terkirim ke nomor mana pun, termasuk nomor karangan di data contoh. Pastikan notify hanya menyala untuk siswa uji.'
          : !isProd && allowlist.length === 0
          ? 'Provider baileys aktif tapi WA_ALLOWLIST kosong — semua pengiriman ditolak.'
          : !isProd
            ? `Hanya ${allowlist.length} nomor di WA_ALLOWLIST yang akan dikirimi.`
            : 'Mode production: seluruh wali murid dengan notify=true akan dikirimi.',
  };
}
