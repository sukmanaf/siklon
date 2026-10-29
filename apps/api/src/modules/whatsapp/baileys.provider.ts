import { access, mkdir, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import type { HasilKirim, StatusProvider, WaProvider } from './provider.js';

/**
 * Provider Baileys — mengirim lewat akun WhatsApp yang men-scan QR pairing.
 *
 * PENTING soal siapa pengirimnya: Baileys bekerja sebagai perangkat WhatsApp
 * Web, jadi pesan keluar dari nomor yang men-scan QR. Kalau yang men-scan
 * adalah WhatsApp pribadi, nomor pribadi itulah yang berisiko diblokir Meta
 * bila ada penerima yang melaporkannya sebagai spam. Pakai nomor khusus sekolah.
 *
 * Impor Baileys dilakukan DINAMIS di dalam sambungkan(), bukan di atas berkas:
 * paketnya berat, dan aplikasi tidak boleh gagal start hanya karena dependensi
 * WhatsApp bermasalah — padahal presensinya sendiri masih bisa jalan.
 */
export class BaileysProvider implements WaProvider {
  readonly nama = 'baileys';

  private sock: unknown = null;
  private tersambung = false;
  private nomor: string | null = null;
  private qrTerakhir: string | null = null;
  private sejak: Date | null = null;
  private errorTerakhir: string | null = null;
  private handler: ((dari: string, teks: string) => void) | null = null;
  private sedangSambung = false;

  siap() {
    return this.tersambung;
  }

  status(): StatusProvider {
    return {
      nama: this.nama,
      tersambung: this.tersambung,
      nomor: this.nomor,
      qr: this.qrTerakhir,
      tersambungSejak: this.sejak,
      errorTerakhir: this.errorTerakhir,
    };
  }

  private async bersihkanSesiMati(): Promise<void> {
    const dirSesi = resolve(env.WA_SESSION_PATH);
    const cap = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    try {
      await rename(dirSesi, `${dirSesi}-lama-${cap}`);
      logger.info({ arsip: `${dirSesi}-lama-${cap}` }, 'Sesi WhatsApp mati berhasil diarsipkan');
    } catch {
      try {
        await rm(dirSesi, { recursive: true, force: true });
        logger.info('Folder sesi WhatsApp mati dibersihkan');
      } catch (e) {
        logger.warn({ e }, 'Gagal membersihkan folder sesi WhatsApp mati');
      }
    }
  }

  async sambungkan(): Promise<void> {
    if (this.sedangSambung || this.tersambung) return;
    this.sedangSambung = true;

    try {
      // Jika sesi sebelumnya dicabut dari HP, bersihkan data sesi lama yang mati
      // agar Baileys tidak mencoba login dengan kredensial basi, melainkan menerbitkan QR baru.
      if (this.errorTerakhir?.includes('Sesi dicabut')) {
        await this.bersihkanSesiMati();
        this.errorTerakhir = null;
      }

      const baileys = await import('@whiskeysockets/baileys');
      const makeWASocket = (baileys as unknown as { default?: unknown }).default ?? baileys.makeWASocket;
      const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = baileys;

      const dirSesi = resolve(env.WA_SESSION_PATH);
      await mkdir(dirSesi, { recursive: true });

      // Sesi disimpan di berkas. Volume ini WAJIB persisten di produksi —
      // kalau hilang, admin harus scan QR pairing ulang setiap restart.
      const { state, saveCreds } = await useMultiFileAuthState(dirSesi);
      const { version } = await fetchLatestBaileysVersion();

      const sock = (makeWASocket as (o: unknown) => unknown)({
        auth: state,
        version,
        browser: Browsers.windows('Chrome'),
        printQRInTerminal: false,
        // Log Baileys sendiri disenyapkan: isinya sangat berisik dan bisa
        // memuat metadata percakapan yang tidak perlu masuk log kita.
        logger: logger.child({ modul: 'baileys' }, { level: 'silent' }),
        markOnlineOnConnect: true,
        syncFullHistory: false,
        connectTimeoutMs: 60_000,
        defaultQueryTimeoutMs: 30_000,
        keepAliveIntervalMs: 30_000,
      });
      this.sock = sock;

      const ev = (sock as { ev: { on: (e: string, cb: (a: unknown) => void) => void } }).ev;

      ev.on('creds.update', () => void saveCreds());

      ev.on('connection.update', (raw) => {
        const u = raw as {
          connection?: string;
          qr?: string;
          lastDisconnect?: { error?: { output?: { statusCode?: number } } };
        };

        if (u.qr) {
          this.qrTerakhir = u.qr;
          logger.info('QR pairing WhatsApp baru tersedia — buka halaman WhatsApp untuk memindainya');
        }

        if (u.connection === 'open') {
          this.tersambung = true;
          this.sejak = new Date();
          this.qrTerakhir = null;
          this.errorTerakhir = null;
          const me = (sock as { user?: { id?: string } }).user;
          this.nomor = me?.id?.split(':')[0] ?? null;
          logger.info({ nomor: this.nomor }, 'WhatsApp tersambung');
        }

        if (u.connection === 'close') {
          this.tersambung = false;
          this.sejak = null;
          const kode = u.lastDisconnect?.error?.output?.statusCode;

          // loggedOut berarti sesi dicabut dari HP: menyambung ulang otomatis
          // hanya akan gagal terus. Admin harus scan QR baru.
          if (kode === DisconnectReason.loggedOut) {
            this.errorTerakhir = 'Sesi dicabut dari HP. Perlu scan QR pairing ulang.';
            logger.error(this.errorTerakhir);
            this.sedangSambung = false;
            void this.bersihkanSesiMati();
          } else {
            this.errorTerakhir = `Koneksi terputus (kode ${kode ?? '-'}), mencoba menyambung ulang`;
            logger.warn(this.errorTerakhir);
            this.sedangSambung = false;
            setTimeout(() => void this.sambungkan(), 5_000);
          }
        }
      });

      ev.on('messages.upsert', (raw) => {
        const u = raw as {
          messages?: {
            key?: { remoteJid?: string; fromMe?: boolean };
            message?: { conversation?: string; extendedTextMessage?: { text?: string } };
          }[];
        };
        for (const m of u.messages ?? []) {
          if (m.key?.fromMe) continue;
          const jid = m.key?.remoteJid ?? '';
          if (!jid.endsWith('@s.whatsapp.net')) continue; // lewati grup & status
          const teks = m.message?.conversation ?? m.message?.extendedTextMessage?.text ?? '';
          if (teks) this.handler?.(jid.split('@')[0]!, teks);
        }
      });
    } catch (err) {
      this.errorTerakhir = (err as Error).message;
      logger.error({ err }, 'Gagal menyambung ke WhatsApp');
      throw err;
    } finally {
      this.sedangSambung = false;
    }
  }

  /**
   * Sesi dianggap ada bila `creds.json` sudah tertulis. Dipakai saat server
   * start untuk membedakan "tinggal menyambung ulang" dari "belum pernah
   * dipasangkan sama sekali" — yang kedua tidak boleh disambungkan otomatis
   * karena cuma akan menerbitkan QR yang tidak dilihat siapa pun.
   */
  async punyaSesi(): Promise<boolean> {
    try {
      await access(resolve(env.WA_SESSION_PATH, 'creds.json'));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Buang sesi supaya bisa ditautkan ke nomor lain.
   *
   * Foldernya DIARSIPKAN, bukan dihapus. Menautkan nomor baru adalah tindakan
   * yang tidak bisa dibatalkan dari sisi WhatsApp, jadi menyisakan salinan
   * kredensial lama tidak ada ruginya — dan sangat menolong kalau ternyata
   * tombolnya tertekan tanpa sengaja.
   */
  async hapusSesi(): Promise<void> {
    await this.putuskan();
    // Beri jeda sejenak agar proses dan handle berkas di Windows tertutup
    await new Promise((r) => setTimeout(r, 200));
    await this.bersihkanSesiMati();

    this.qrTerakhir = null;
    this.errorTerakhir = null;
    this.sedangSambung = false;
  }

  async putuskan(): Promise<void> {
    const sock = this.sock as { logout?: () => Promise<void>; end?: (e?: Error) => void } | null;
    try {
      await sock?.logout?.();
    } catch {
      sock?.end?.(undefined);
    }
    this.sock = null;
    this.tersambung = false;
    this.nomor = null;
    this.sejak = null;
  }

  async kirim(nomor: string, isi: string): Promise<HasilKirim> {
    if (!this.tersambung || !this.sock) {
      return { ok: false, kode: 'BELUM_TERSAMBUNG', pesan: 'WhatsApp belum tersambung' };
    }

    const sock = this.sock as {
      sendPresenceUpdate?: (type: 'available' | 'unavailable' | 'composing' | 'recording' | 'paused', toJid?: string) => Promise<void>;
      presenceSubscribe?: (toJid: string) => Promise<void>;
      sendMessage: (jid: string, isi: { text: string }) => Promise<{ key?: { id?: string } } | undefined>;
    };

    const jid = `${nomor}@s.whatsapp.net`;

    try {
      // 1. Simulasi kehadiran manusia & status mengetik (Anti-Bot Detection)
      // Jangan gunakan sock.onWhatsApp() karena probe nomor memicu kecurigaan spam Meta.
      try {
        await sock.sendPresenceUpdate?.('available');
        await sock.presenceSubscribe?.(jid);
        await sock.sendPresenceUpdate?.('composing', jid);

        // Jeda mengetik alami (1.5 - 3.5 detik) seolah manusia sedang mengetik
        const jedaKetik = Math.min(3500, Math.max(1200, Math.floor(isi.length * 12 + Math.random() * 800)));
        await new Promise((r) => setTimeout(r, jedaKetik));

        await sock.sendPresenceUpdate?.('paused', jid);
      } catch (errPresensi) {
        logger.debug({ err: errPresensi }, 'Gagal mengirim presence composing WA');
      }

      // 2. Kirim pesan dengan batas waktu (timeout 25 detik)
      const kirimPromise = sock.sendMessage(jid, { text: isi });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout pengiriman WhatsApp (25 detik)')), 25_000),
      );

      const hasil = await Promise.race([kirimPromise, timeoutPromise]);
      return { ok: true, providerMessageId: hasil?.key?.id ?? `wa-${Date.now()}` };
    } catch (err) {
      const pesan = (err as Error).message || '';
      logger.warn({ err, nomor }, 'Gagal mengirim pesan WhatsApp');
      const tidakTerdaftar = /not-authorized|item-not-found|not registered|not on whatsapp|404/i.test(pesan);
      return {
        ok: false,
        kode: tidakTerdaftar ? 'NOMOR_TIDAK_TERDAFTAR' : 'TIDAK_DIKETAHUI',
        pesan,
      };
    }
  }

  onPesanMasuk(handler: (dari: string, teks: string) => void) {
    this.handler = handler;
  }
}
