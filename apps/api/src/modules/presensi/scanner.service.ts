import type { Scanner } from '@siklon/shared';
import { logger } from '../../config/logger.js';
import { agentTersambung, dorongKonfigKeAgent, siarkanPorts, type PortTerdeteksi } from '../../realtime/socket.js';
import { ambil as ambilSetting, simpan as simpanSetting } from '../settings/settings.service.js';
import { Conflict } from '../../lib/errors.js';

/**
 * Keadaan sesaat: port yang barusan dilaporkan agent, dan mode identifikasi.
 * Sengaja TIDAK disimpan di database — ini data yang basi dalam hitungan detik
 * dan tidak ada gunanya bertahan setelah server restart.
 */
let portTerakhir: PortTerdeteksi[] = [];
let agentTerlihatPada: Date | null = null;
let versiAgent: string | null = null;

/** Mode identifikasi: scan tidak dicatat sebagai presensi selama aktif. */
let identifikasiSampai: number | null = null;

const DURASI_IDENTIFIKASI_MS = 60_000;

/** Agent melapor tiap 60 detik; 3 menit tanpa kabar berarti bermasalah. */
const BATAS_SEGAR_MS = 3 * 60_000;

const segarDalam = (ms: number) =>
  agentTerlihatPada !== null && Date.now() - agentTerlihatPada.getTime() < ms;

/**
 * Kunci pemetaan dipilih dari yang paling stabil ke yang paling rapuh.
 * Nomor COM di Windows bisa berubah sendiri saat colokan USB dipindah; kalau
 * pemetaan dikunci ke COM3, presensi bisa tercatat dari gerbang yang salah
 * tanpa ada yang sadar.
 */
export function kunciStabil(p: PortTerdeteksi): string {
  if (p.serialNumber) return `SN:${p.serialNumber}`;
  if (p.locationId) return `USB:${p.locationId}`;
  return `PORT:${p.path}`;
}

export async function laporanAgent(data: { agentVersion?: string; ports: PortTerdeteksi[] }) {
  portTerakhir = data.ports;
  agentTerlihatPada = new Date();
  versiAgent = data.agentVersion ?? null;

  const pemetaan = await ambilSetting('scanners');
  siarkanPorts(true, data.ports);

  // Balas dengan port yang harus dibuka agent beserta kodenya.
  const peta = new Map(pemetaan.map((s) => [s.id, s]));
  const dibuka = data.ports
    .map((p) => ({ port: p, cocok: peta.get(kunciStabil(p)) }))
    .filter((x) => x.cocok?.aktif)
    .map((x) => ({ path: x.port.path, kode: x.cocok!.kode, label: x.cocok!.label }));

  const belumDinamai = data.ports.filter((p) => !peta.has(kunciStabil(p))).length;
  if (belumDinamai > 0) {
    logger.info({ belumDinamai }, 'Ada port scanner yang belum diberi nama');
  }

  return {
    bukaPort: dibuka,
    debounceDetik: (await ambilSetting('scan')).debounce_detik,
    modeIdentifikasi: modeIdentifikasiAktif(),
    belumDinamai,
  };
}

export async function daftarScanner() {
  const pemetaan = await ambilSetting('scanners');
  const peta = new Map(pemetaan.map((s) => [s.id, s]));

  const terdeteksi = portTerakhir.map((p) => {
    const kunci = kunciStabil(p);
    const cocok = peta.get(kunci);
    return {
      kunci,
      path: p.path,
      merek: p.manufacturer ?? null,
      vidPid: p.vendorId && p.productId ? `${p.vendorId}:${p.productId}` : null,
      // Peringatan ini penting: tanpa nomor seri, pemetaan ikut lokasi colokan.
      tanpaNomorSeri: !p.serialNumber,
      sudahDinamai: Boolean(cocok),
      kode: cocok?.kode ?? null,
      label: cocok?.label ?? null,
      tipe: cocok?.tipe ?? 'SERIAL',
      aktif: cocok?.aktif ?? false,
    };
  });

  // Pemetaan yang tersimpan tapi perangkatnya tidak terdeteksi — biasanya
  // scanner dicabut atau agent belum jalan. Harus terlihat, bukan hilang.
  const idTerdeteksi = new Set(terdeteksi.map((t) => t.kunci));
  const tidakTerdeteksi = pemetaan
    .filter((s) => !idTerdeteksi.has(s.id))
    .map((s) => ({ ...s, terdeteksi: false as const }));

  return {
    agent: {
      // Agent bisa hidup tanpa socket (hanya mengirim HTTP), jadi "online"
      // ditentukan dari socket ATAU laporan terakhir yang masih segar.
      online: agentTersambung() || segarDalam(BATAS_SEGAR_MS),
      lewatSocket: agentTersambung(),
      terlihatPada: agentTerlihatPada,
      versi: versiAgent,
    },
    modeIdentifikasi: modeIdentifikasiAktif(),
    terdeteksi,
    tidakTerdeteksi,
  };
}

export async function simpanPemetaan(scanners: Scanner[], userId: string) {
  const kodeTerlihat = new Set<string>();
  for (const s of scanners) {
    if (kodeTerlihat.has(s.kode)) {
      // Kode ganda berarti dua gerbang tercatat dengan nama sama, dan laporan
      // tidak bisa lagi membedakan asal scan. Ditolak dengan pesan yang jelas,
      // bukan Error biasa yang berakhir jadi 500 generik.
      throw Conflict(`Kode titik scan "${s.kode}" dipakai lebih dari sekali`);
    }
    kodeTerlihat.add(s.kode);
  }

  const disimpan = await simpanSetting('scanners', scanners, userId);
  // Agent menerapkan pemetaan baru tanpa perlu restart PC gerbang.
  dorongKonfigKeAgent(scanners);
  logger.info({ jumlah: scanners.length, oleh: userId }, 'Pemetaan scanner diperbarui');
  return disimpan;
}

// ---------------- Mode identifikasi ----------------

export function mulaiIdentifikasi() {
  identifikasiSampai = Date.now() + DURASI_IDENTIFIKASI_MS;
  return {
    aktifSampai: new Date(identifikasiSampai),
    detik: DURASI_IDENTIFIKASI_MS / 1000,
    pesan: 'Tempelkan barcode apa saja di scanner yang ingin diberi nama. Scan tidak dicatat sebagai presensi.',
  };
}

export function hentikanIdentifikasi() {
  identifikasiSampai = null;
  return { pesan: 'Mode identifikasi dihentikan' };
}

export function modeIdentifikasiAktif(): boolean {
  if (identifikasiSampai === null) return false;
  if (Date.now() > identifikasiSampai) {
    identifikasiSampai = null;
    return false;
  }
  return true;
}

/** Cari kode titik scan dari path port yang dilaporkan agent. */
export async function kodeDariPort(path: string): Promise<string | null> {
  const port = portTerakhir.find((p) => p.path === path);
  if (!port) return null;
  const pemetaan = await ambilSetting('scanners');
  return pemetaan.find((s) => s.id === kunciStabil(port))?.kode ?? null;
}
