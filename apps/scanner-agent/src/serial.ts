import { SerialPort } from 'serialport';
import { log } from './log.js';

export type PortInfo = {
  path: string;
  serialNumber?: string | null;
  vendorId?: string | null;
  productId?: string | null;
  manufacturer?: string | null;
  locationId?: string | null;
};

/**
 * Linux selalu memunculkan /dev/ttyS0..S31 — port serial bawaan motherboard
 * yang hampir selalu tidak terpakai. Kalau ikut dilaporkan, halaman Scanner
 * dibanjiri 32 baris tak berguna dan petugas tidak bisa menemukan scannernya.
 *
 * Yang disaring HANYA ttyS tanpa identitas USB. Port ttyS yang benar-benar
 * punya perangkat (misalnya scanner RS232 lewat adaptor) tetap dilaporkan
 * karena ia punya vendorId.
 */
function kemungkinanBesarBukanScanner(p: PortInfo): boolean {
  return /^\/dev\/ttyS\d+$/.test(p.path) && !p.vendorId && !p.serialNumber;
}

/**
 * Daftar port serial yang terlihat sistem.
 *
 * Yang dilaporkan bukan hanya path (COM3, /dev/ttyACM0) tapi juga nomor seri,
 * VID:PID, dan lokasi USB — karena server memetakan scanner berdasarkan nomor
 * seri, bukan nomor port. Nomor COM di Windows bisa berubah sendiri saat
 * colokan dipindah; nomor seri tidak.
 *
 * @param semua true untuk melewati penyaringan, dipakai saat mendiagnosa.
 * @param tambahan path yang dilaporkan manual dari config.json.
 */
export async function daftarPort(semua = false, tambahan: string[] = []): Promise<PortInfo[]> {
  const ports = await SerialPort.list();
  const hasil: PortInfo[] = ports.map((p) => ({
    path: p.path,
    serialNumber: p.serialNumber ?? null,
    vendorId: p.vendorId ?? null,
    productId: p.productId ?? null,
    manufacturer: p.manufacturer ?? null,
    locationId: (p as { locationId?: string }).locationId ?? null,
  }));

  const disaring = semua ? hasil : hasil.filter((p) => !kemungkinanBesarBukanScanner(p));
  if (!semua) {
    const dibuang = hasil.length - disaring.length;
    if (dibuang > 0) {
      log.debug(`${dibuang} port serial bawaan motherboard (/dev/ttyS*) tidak dilaporkan`);
    }
  }

  // Port manual ditambahkan setelah penyaringan, jadi tidak bisa ikut terbuang.
  const sudahAda = new Set(disaring.map((p) => p.path));
  for (const path of tambahan) {
    if (sudahAda.has(path)) continue;
    disaring.push({
      path,
      serialNumber: null,
      vendorId: null,
      productId: null,
      manufacturer: 'ditambahkan manual (config.json)',
      locationId: null,
    });
  }
  return disaring;
}

export type PortTerbuka = { path: string; kode: string; tutup: () => void };

/**
 * Buka satu port dan panggil `onScan` setiap kali satu baris utuh terbaca.
 *
 * Scanner mengirim isi barcode diakhiri CR, LF, atau CRLF — tergantung merek
 * dan setelannya. Data juga bisa tiba terpotong di tengah, jadi potongan
 * ditampung dulu sampai ada pemisah baris. Membaca per-chunk tanpa penampung
 * akan memotong NIS jadi dua.
 */
export function bukaPort(
  path: string,
  kode: string,
  onScan: (isi: string) => void,
  onError: (pesan: string) => void,
): PortTerbuka {
  // 9600 8N1 adalah setelan bawaan hampir semua scanner mode Virtual COM.
  const port = new SerialPort({ path, baudRate: 9600, autoOpen: false });

  let penampung = '';
  const MAKS_PENAMPUNG = 256;

  port.on('data', (data: Buffer) => {
    penampung += data.toString('utf8');

    // Penampung membengkak berarti scanner mengirim tanpa pemisah baris.
    // Dibuang daripada tumbuh tak terbatas sampai memori habis.
    if (penampung.length > MAKS_PENAMPUNG) {
      log.warn(`${path}: data tanpa pemisah baris melebihi ${MAKS_PENAMPUNG} karakter, dibuang`);
      penampung = '';
      return;
    }

    const bagian = penampung.split(/\r\n|\r|\n/);
    // Elemen terakhir belum tentu utuh — simpan untuk chunk berikutnya.
    penampung = bagian.pop() ?? '';

    for (const b of bagian) {
      const isi = b.trim();
      if (isi) onScan(isi);
    }
  });

  port.on('error', (err) => onError(err.message));
  port.on('close', () => log.warn(`${path} (${kode}) tertutup`));

  port.open((err) => {
    if (err) onError(`gagal membuka ${path}: ${err.message}`);
    else log.info(`${path} dibuka sebagai ${kode}`);
  });

  return {
    path,
    kode,
    tutup: () => {
      try {
        if (port.isOpen) port.close();
      } catch {
        /* sudah tertutup */
      }
    },
  };
}
