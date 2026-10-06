import { logger } from '../../config/logger.js';

export type HasilKirim =
  | { ok: true; providerMessageId: string }
  | { ok: false; kode: KodeGagal; pesan: string };

export type KodeGagal =
  /** Nomor tidak terdaftar di WhatsApp — mencoba ulang tidak akan menolong. */
  | 'NOMOR_TIDAK_TERDAFTAR'
  /** Provider belum tersambung; pesan tetap di antrean. */
  | 'BELUM_TERSAMBUNG'
  | 'DIBATASI_PROVIDER'
  | 'DILUAR_ALLOWLIST'
  | 'TIDAK_DIKETAHUI';

/** Kegagalan yang tidak ada gunanya dicoba ulang. */
export const GAGAL_PERMANEN: readonly KodeGagal[] = ['NOMOR_TIDAK_TERDAFTAR', 'DILUAR_ALLOWLIST'];

export type StatusProvider = {
  nama: string;
  tersambung: boolean;
  nomor: string | null;
  qr: string | null;
  tersambungSejak: Date | null;
  errorTerakhir: string | null;
};

export interface WaProvider {
  readonly nama: string;
  siap(): boolean;
  status(): StatusProvider;
  /** Mulai proses pairing. Mengembalikan QR bila provider membutuhkannya. */
  sambungkan(): Promise<void>;
  putuskan(): Promise<void>;
  kirim(nomor: string, isi: string): Promise<HasilKirim>;
  /** Dipanggil saat ada pesan masuk — dipakai untuk opt-out "BERHENTI". */
  onPesanMasuk(handler: (dari: string, teks: string) => void): void;

  /**
   * Apakah sudah ada sesi tersimpan, sehingga `sambungkan()` tidak akan
   * memunculkan QR baru. Opsional: hanya provider yang menyimpan kredensial
   * di disk yang perlu menjawabnya.
   */
  punyaSesi?(): Promise<boolean>;

  /**
   * Buang sesi tersimpan supaya bisa ditautkan ke nomor lain.
   * Opsional, dengan alasan yang sama seperti `punyaSesi()`.
   */
  hapusSesi?(): Promise<void>;
}

/**
 * Provider dummy: mencatat ke log, tidak mengirim apa pun.
 *
 * Ini yang membuat seluruh alur notifikasi (antrean, template, rate limit,
 * retry, log) bisa dikembangkan dan diuji tanpa satu pun pesan sungguhan
 * terkirim ke orang.
 */
export class DummyProvider implements WaProvider {
  readonly nama = 'dummy';
  private handler: ((dari: string, teks: string) => void) | null = null;
  private sejak: Date | null = null;

  siap() {
    return true;
  }

  status(): StatusProvider {
    return {
      nama: this.nama,
      tersambung: true,
      nomor: '(dummy — tidak mengirim apa pun)',
      qr: null,
      tersambungSejak: this.sejak,
      errorTerakhir: null,
    };
  }

  async sambungkan() {
    this.sejak = new Date();
  }

  async putuskan() {
    this.sejak = null;
  }

  async kirim(nomor: string, isi: string): Promise<HasilKirim> {
    logger.info(
      { ke: nomor, panjang: isi.length, cuplikan: isi.slice(0, 60).replace(/\n/g, ' ') },
      '[DUMMY] pesan TIDAK dikirim, hanya dicatat',
    );
    return { ok: true, providerMessageId: `dummy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
  }

  onPesanMasuk(handler: (dari: string, teks: string) => void) {
    this.handler = handler;
  }

  /** Hanya untuk pengujian: mensimulasikan wali murid membalas "BERHENTI". */
  simulasiPesanMasuk(dari: string, teks: string) {
    this.handler?.(dari, teks);
  }
}
