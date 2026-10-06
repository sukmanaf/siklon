import { access, mkdir, rename } from 'node:fs/promises';
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

  async sambungkan(): Promise<void> {
    if (this.sedangSambung || this.tersambung) return;
    this.sedangSambung = true;

    try {
      const baileys = await import('@whiskeysockets/baileys');
      const makeWASocket = (baileys as unknown as { default?: unknown }).default ?? baileys.makeWASocket;
      const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys;

      const dirSesi = resolve(env.WA_SESSION_PATH);
      await mkdir(dirSesi, { recursive: true });

      // Sesi disimpan di berkas. Volume ini WAJIB persisten di produksi —
      // kalau hilang, admin harus scan QR pairing ulang setiap restart.
      const { state, saveCreds } = await useMultiFileAuthState(dirSesi);
      const { version } = await fetchLatestBaileysVersion();

      const sock = (makeWASocket as (o: unknown) => unknown)({
        auth: state,
        version,
        printQRInTerminal: false,
        // Log Baileys sendiri disenyapkan: isinya sangat berisik dan bisa
        // memuat metadata percakapan yang tidak perlu masuk log kita.
        logger: logger.child({ modul: 'baileys' }, { level: 'silent' }),
        markOnlineOnConnect: false,
        syncFullHistory: false,
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

    const dirSesi = resolve(env.WA_SESSION_PATH);
    const cap = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    try {
      await rename(dirSesi, `${dirSesi}-lama-${cap}`);
      logger.info({ arsip: `${dirSesi}-lama-${cap}` }, 'Sesi WhatsApp diarsipkan');
    } catch {
      // Folder belum pernah dibuat — tidak ada yang perlu diarsipkan.
    }

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
      onWhatsApp?: (n: string) => Promise<{ exists?: boolean }[] | undefined>;
      sendMessage: (jid: string, isi: { text: string }) => Promise<{ key?: { id?: string } } | undefined>;
    };

    try {
      // Diperiksa dulu apakah nomornya benar-benar punya WhatsApp. Tanpa ini,
      // nomor salah tulis akan dicoba ulang tiga kali dengan sia-sia dan
      // menghabiskan kuota harian.
      const cek = await sock.onWhatsApp?.(nomor);
      if (cek && cek.length > 0 && cek[0]?.exists === false) {
        return {
          ok: false,
          kode: 'NOMOR_TIDAK_TERDAFTAR',
          pesan: `Nomor ${nomor} tidak terdaftar di WhatsApp`,
        };
      }

      const hasil = await sock.sendMessage(`${nomor}@s.whatsapp.net`, { text: isi });
      return { ok: true, providerMessageId: hasil?.key?.id ?? `wa-${Date.now()}` };
    } catch (err) {
      const pesan = (err as Error).message;
      logger.warn({ err, nomor }, 'Gagal mengirim pesan WhatsApp');
      return { ok: false, kode: 'TIDAK_DIKETAHUI', pesan };
    }
  }

  onPesanMasuk(handler: (dari: string, teks: string) => void) {
    this.handler = handler;
  }
}
