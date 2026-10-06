import { log } from './log.js';
import type { PortInfo } from './serial.js';

export type BukaPortPerintah = { path: string; kode: string; label: string };

export type BalasanHello = {
  bukaPort: BukaPortPerintah[];
  debounceDetik: number;
  modeIdentifikasi: boolean;
  belumDinamai: number;
};

export type HasilKirimScan = {
  ok: boolean;
  kode?: string;
  pesan: string;
  siswa?: { nama: string; kelas: string | null };
  status?: string;
  terlambatMenit?: number;
};

/** Menandai kegagalan yang berarti "coba lagi nanti", bukan "data ini salah". */
export class GagalJaringan extends Error {}

export class ApiKlien {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  private async minta<T>(jalur: string, body: unknown, timeoutMs = 10_000): Promise<T> {
    const batal = AbortSignal.timeout(timeoutMs);
    let res: Response;

    try {
      res = await fetch(`${this.baseUrl}/api/v1${jalur}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': this.apiKey },
        body: JSON.stringify(body),
        signal: batal,
      });
    } catch (err) {
      // Server mati, kabel jaringan lepas, atau DNS gagal — semuanya layak
      // dicoba ulang, dan datanya harus tetap di antrean.
      throw new GagalJaringan((err as Error).message);
    }

    if (res.status === 401 || res.status === 403) {
      // apiKey salah tidak akan membaik dengan mencoba ulang. Dilaporkan keras
      // supaya petugas tahu harus menempelkan kunci yang benar.
      log.error('X-Api-Key ditolak server. Periksa apiKey di config.json.');
      throw new Error(`kunci API ditolak (HTTP ${res.status})`);
    }

    if (res.status >= 500) throw new GagalJaringan(`server error HTTP ${res.status}`);

    const isi = (await res.json().catch(() => null)) as
      | { ok: boolean; data?: T; error?: { message?: string } }
      | null;

    if (!isi) throw new Error(`jawaban server bukan JSON (HTTP ${res.status})`);
    if (!isi.ok) throw new Error(isi.error?.message ?? `HTTP ${res.status}`);
    return isi.data as T;
  }

  hello(ports: PortInfo[], agentVersion: string): Promise<BalasanHello> {
    return this.minta<BalasanHello>('/agent/hello', { agentVersion, ports });
  }

  /**
   * `gate` dikirim bersama `portPath`. Agent sudah tahu kode gerbangnya —
   * server sendiri yang memberitahukannya saat membuka port — jadi tidak perlu
   * menerjemahkan ulang di server dari daftar port yang bisa kosong.
   */
  scan(nis: string, portPath: string, gate: string, scannedAt: string): Promise<HasilKirimScan> {
    return this.minta<HasilKirimScan>('/scans', { nis, portPath, gate, scannedAt }, 8_000);
  }

  /** Kirim antrean offline. Timeout lebih panjang karena isinya bisa 200 item. */
  batch(
    items: { nis: string; portPath: string; gate?: string; scannedAt: string }[],
  ): Promise<{ diproses: number; berhasil: number; ditolak: number }> {
    return this.minta('/scans/batch', { items }, 60_000);
  }
}
