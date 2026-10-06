import { io, type Socket } from 'socket.io-client';
import { ApiKlien, GagalJaringan, type BukaPortPerintah } from './api.js';
import { Antrean } from './antrean.js';
import { bacaKonfigurasi } from './config.js';
import { Debounce } from './debounce.js';
import { log, setLevel } from './log.js';
import { bukaPort, daftarPort, type PortTerbuka } from './serial.js';

const VERSI = '1.0.0';

const cfg = bacaKonfigurasi(process.env['SIKLON_CONFIG'] ?? 'config.json');
setLevel(cfg.logLevel);

const api = new ApiKlien(cfg.apiUrl, cfg.apiKey);
const antrean = new Antrean(cfg.antreanPath);
const debounce = new Debounce(60);

const terbuka = new Map<string, PortTerbuka>();
let pemetaanTerakhir: BukaPortPerintah[] = [];
/** Dipakai agar peringatan "belum dipetakan" tidak diulang tiap siklus lapor. */
let sudahMemperingatkanKosong = false;
let onlineTerakhir: boolean | null = null;
let socket: Socket | null = null;

/** Cetak status koneksi hanya saat BERUBAH, supaya log tidak banjir. */
function catatStatus(online: boolean) {
  if (onlineTerakhir === online) return;
  onlineTerakhir = online;
  const n = antrean.jumlah();
  log[online ? 'info' : 'warn'](
    online
      ? `Tersambung ke server${n > 0 ? ` — mengirim ${n} scan tertunda` : ''}`
      : `OFFLINE — scan ditampung di antrean lokal (${n} tertunda)`,
  );
}

// =====================================================================
// Satu scan masuk
// =====================================================================
async function tanganiScan(nis: string, portPath: string, kode: string) {
  if (debounce.perluDiabaikan(nis)) {
    log.debug(`${nis} diabaikan (scan ganda dalam ${60} detik)`);
    return;
  }

  const scannedAt = new Date().toISOString();

  try {
    const h = await api.scan(nis, portPath, kode, scannedAt);
    catatStatus(true);

    const siapa = h.siswa ? `${h.siswa.nama} (${h.siswa.kelas ?? '-'})` : nis;
    if (h.ok) log.info(`✓ ${siapa} — ${h.pesan}`);
    else log.warn(`✗ ${siapa} — ${h.pesan}`);
  } catch (err) {
    if (err instanceof GagalJaringan) {
      // Inti mode offline: scan TIDAK boleh hilang hanya karena internet mati.
      antrean.tambah(nis, portPath, kode, scannedAt);
      catatStatus(false);
      log.warn(`${nis} masuk antrean offline (${antrean.jumlah()} tertunda)`);
    } else {
      log.error(`${nis} gagal: ${(err as Error).message}`);
    }
  }
}

// =====================================================================
// Terapkan pemetaan port dari server
// =====================================================================
function terapkanPemetaan(perintah: BukaPortPerintah[]) {
  const diminta = new Map(perintah.map((p) => [p.path, p]));

  // Tutup port yang tidak lagi dipetakan, atau yang kodenya berubah.
  for (const [path, p] of terbuka) {
    const baru = diminta.get(path);
    if (!baru || baru.kode !== p.kode) {
      p.tutup();
      terbuka.delete(path);
      log.info(`${path} ditutup (pemetaan berubah)`);
    }
  }

  // Buka yang belum terbuka.
  for (const p of perintah) {
    if (terbuka.has(p.path)) continue;
    const port = bukaPort(
      p.path,
      p.kode,
      (isi) => void tanganiScan(isi, p.path, p.kode),
      (pesan) => log.error(`${p.path}: ${pesan}`),
    );
    terbuka.set(p.path, port);
  }

  pemetaanTerakhir = perintah;

  // Peringatan ini hanya dicetak sekali. Kalau diulang tiap siklus lapor
  // (default 60 detik), lognya penuh dan pesan penting jadi tertimbun.
  if (perintah.length === 0 && !sudahMemperingatkanKosong) {
    sudahMemperingatkanKosong = true;
    log.warn(
      'Belum ada scanner yang dipetakan. Buka halaman Scanner di aplikasi, ' +
        'tekan "Kenali Scanner", lalu tempelkan barcode di scanner yang ingin dinamai.',
    );
  } else if (perintah.length > 0) {
    sudahMemperingatkanKosong = false;
  }
}

// =====================================================================
// Lapor ke server: port apa saja yang terlihat
// =====================================================================
async function lapor() {
  try {
    const ports = await daftarPort(false, cfg.portTambahan);
    const balas = await api.hello(ports, VERSI);
    catatStatus(true);

    debounce.setDetik(balas.debounceDetik);
    terapkanPemetaan(balas.bukaPort);

    if (balas.belumDinamai > 0) {
      log.info(`${balas.belumDinamai} port terdeteksi tapi belum diberi nama di aplikasi`);
    }
  } catch (err) {
    if (err instanceof GagalJaringan) catatStatus(false);
    else log.error(`Gagal melapor ke server: ${(err as Error).message}`);
  }
}

// =====================================================================
// Kirim antrean offline
// =====================================================================
async function kirimAntrean() {
  const tertunda = antrean.ambil(200);
  if (tertunda.length === 0) return;

  try {
    const hasil = await api.batch(
      tertunda.map((t) => ({
        nis: t.nis,
        portPath: t.portPath,
        gate: t.kode || undefined,
        scannedAt: t.scannedAt,
      })),
    );
    catatStatus(true);

    // Dihapus setelah server MENERIMA, apa pun keputusannya. Scan yang ditolak
    // (hari libur, sudah absen) tidak akan pernah berubah jadi diterima —
    // menyimpannya hanya membuat antrean mencoba selamanya.
    antrean.hapus(tertunda.map((t) => t.id));
    log.info(
      `Antrean terkirim: ${hasil.berhasil} tercatat, ${hasil.ditolak} ditolak, ` +
        `sisa ${antrean.jumlah()}`,
    );
  } catch (err) {
    antrean.tandaiGagal(
      tertunda.map((t) => t.id),
      (err as Error).message,
    );
    if (err instanceof GagalJaringan) catatStatus(false);
    else log.error(`Gagal mengirim antrean: ${(err as Error).message}`);
    antrean.bersihkanMacet();
  }
}

// =====================================================================
// WebSocket: menerima perubahan pemetaan tanpa restart
// =====================================================================
function sambungSocket() {
  socket = io(cfg.apiUrl, {
    auth: { apiKey: cfg.apiKey },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 3_000,
    reconnectionDelayMax: 30_000,
  });

  socket.on('connect', () => log.info('Kanal perubahan pemetaan tersambung'));

  socket.on('scanner:config', () => {
    // Server hanya memberi tahu "ada perubahan"; agent bertanya lagi supaya
    // yang dipakai selalu bentuk final dari server, bukan hasil tafsir sendiri.
    log.info('Pemetaan scanner diperbarui dari aplikasi — menerapkan tanpa restart');
    void lapor();
  });

  socket.on('connect_error', (e) => log.debug(`Socket gagal menyambung: ${e.message}`));
}

// =====================================================================
// Mulai
// =====================================================================
async function main() {
  log.info(`SIKLON Scanner Agent v${VERSI}`);
  log.info(`Server   : ${cfg.apiUrl}`);
  log.info(`Antrean  : ${cfg.antreanPath} (${antrean.jumlah()} tertunda)`);

  const ports = await daftarPort(false, cfg.portTambahan);
  log.info(`Port serial terdeteksi: ${ports.length === 0 ? 'tidak ada' : ports.map((p) => p.path).join(', ')}`);
  if (ports.length === 0) {
    log.warn(
      'Tidak ada port serial. Pastikan scanner sudah diubah ke mode USB Virtual COM Port ' +
        '(scan barcode setup dari buku manualnya), bukan mode keyboard.',
    );
  }

  await lapor();
  sambungSocket();

  const timerLapor = setInterval(() => void lapor(), cfg.laporDetik * 1000);
  const timerKirim = setInterval(() => void kirimAntrean(), cfg.kirimUlangDetik * 1000);
  const timerBersih = setInterval(() => debounce.bersihkan(), 10 * 60 * 1000);

  const tutup = (sinyal: string) => () => {
    log.info(`${sinyal} diterima, menutup agent...`);
    clearInterval(timerLapor);
    clearInterval(timerKirim);
    clearInterval(timerBersih);
    for (const p of terbuka.values()) p.tutup();
    socket?.close();
    const sisa = antrean.jumlah();
    if (sisa > 0) log.warn(`${sisa} scan masih di antrean — akan dikirim saat agent dijalankan lagi`);
    antrean.tutup();
    process.exit(0);
  };

  process.on('SIGTERM', tutup('SIGTERM'));
  process.on('SIGINT', tutup('SIGINT'));

  // Agent harus tetap hidup. Error yang tidak tertangani jangan sampai
  // mematikan proses di tengah jam masuk sekolah.
  process.on('uncaughtException', (err) => log.error(`Error tak tertangani: ${err.message}`));
  process.on('unhandledRejection', (r) => log.error(`Promise gagal: ${String(r)}`));
}

void main();

export { pemetaanTerakhir };
