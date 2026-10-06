/**
 * Kamera pemindai dan halaman Scanner.
 *
 * Pelajaran mahal yang dijaga suite ini: pernah terjadi pendekode QR TIDAK
 * pernah bekerja sementara pengujiannya tetap hijau, karena asersinya cuma
 * memeriksa *pustaka mana yang terpilih* — bukan *QR-nya terbaca*. Karena itu
 * di sini Chrome diberi berkas video berisi QR sungguhan lewat
 * `--use-file-for-fake-video-capture`, dan yang diperiksa adalah baris presensi
 * yang muncul di database.
 */

import {
  BASE,
  angka,
  buatPencatat,
  bukaBrowser,
  halamanBaru,
  klik,
  laporAgent,
  masuk,
  pastikanHariSekolah,
  pulihkanNanti,
  sql,
  sqlJalan,
  tangkapLayar,
  teks,
  tunggu,
} from '../bersama.mjs';
import { BERKAS, NIS_QR, siapkanBerkas } from '../siapkan-berkas.mjs';

const { ok, ringkas } = buatPencatat('Kamera & Scanner');
await siapkanBerkas();

/*
 * Sama seperti suite Konsol Scan: hari ini dipastikan terhitung hari sekolah,
 * kalau tidak QR yang terbaca akan ditolak "bukan hari sekolah" dan uji
 * pendekodenya gagal karena sebab yang salah.
 */
const hariSekolah = pastikanHariSekolah();
if (hariSekolah.diubah) {
  console.log(`  (hari ini bukan hari sekolah — setelan dipinjam sementara untuk uji)`);
}

const notifyAwal = sql(`SELECT coalesce(string_agg(id::text, ','), '') FROM students WHERE notify`);
sqlJalan('UPDATE students SET notify = false');
pulihkanNanti(() => {
  sqlJalan('UPDATE students SET notify = false');
  if (notifyAwal) sqlJalan(`UPDATE students SET notify = true WHERE id IN ('${notifyAwal.split(',').join("','")}')`);
});
const bersih = () => sqlJalan('DELETE FROM attendance WHERE attendance_date = CURRENT_DATE');
bersih();

// NIS di dalam QR harus benar-benar ada, kalau tidak yang diuji jadi "NIS tidak terdaftar".
const adaNis = angka(`SELECT count(*) FROM students WHERE nis='${NIS_QR}'`) === 1;

const browser = await bukaBrowser({ umpanVideo: BERKAS.qrY4m });

/** Nyalakan kamera lewat setelan perangkat — Konsol Scan tidak punya pemilih sumber. */
async function halamanKamera(opsi = {}) {
  const p = await halamanBaru(browser, opsi);
  await p.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('siklon-kamera-aktif', 'ya');
    } catch {
      /* diabaikan */
    }
  });
  return p;
}

const p = await halamanKamera();
await masuk(p);

// ---------- Halaman Scanner: satu kartu per kamera ----------
await p.goto(`${BASE}/scanner`, { waitUntil: 'networkidle2' });
await p.waitForFunction(() => /Kamera Perangkat Ini/.test(document.body.innerText), { timeout: 60000 });
await tunggu(4000);
ok('Kamera & pemindai serial diatur di halaman yang sama',
   /Kamera Perangkat Ini/.test(await teks(p)) && /Port Terdeteksi/.test(await teks(p)));

const kartu = await p.$$eval('[data-uji="kartu-kamera"]', (n) =>
  n.map((el) => ({
    dipakai: el.querySelector('button[role="switch"]')?.getAttribute('aria-checked') === 'true',
    adaVideo: Boolean(el.querySelector('video')),
  })));
ok('Tiap kamera punya kartu dan saklarnya sendiri', kartu.length >= 1, `${kartu.length} kamera`);
ok('Kamera yang dipakai menampilkan pratinjaunya',
   kartu.every((k) => !k.dipakai || k.adaVideo));
await tangkapLayar(p, '05-scanner-kamera');

// ---------- QR benar-benar terbaca ----------
await p.goto(`${BASE}/scan`, { waitUntil: 'networkidle2' });
await p.waitForSelector('video', { timeout: 40000 });

const lencana = await p
  .waitForFunction(
    () => (document.querySelector('[data-uji="lencana-kamera"]')?.getAttribute('data-pendekode') ?? '') !== '',
    { timeout: 40000 },
  )
  .then(() => p.evaluate(() => document.querySelector('[data-uji="lencana-kamera"]').getAttribute('data-pendekode')))
  .catch(() => null);
const adaBarcodeDetector = await p.evaluate(() => 'BarcodeDetector' in window);
ok('Jalur pendekode dilaporkan di layar meski videonya disembunyikan', lencana !== null, String(lencana));
ok('Memakai jalur cadangan qr-scanner di Chrome Linux',
   !adaBarcodeDetector && lencana === 'qr-scanner',
   `BarcodeDetector ada: ${adaBarcodeDetector} · dipakai: ${lencana}`);

if (!adaNis) {
  ok(`QR berisi NIS ${NIS_QR} yang tidak ada di database`, false, 'siapkan siswa uji dulu');
} else {
  const terbaca = await p
    .waitForFunction(() => /HADIR|TERLAMBAT|PULANG|Ditolak/.test(document.body.innerText), { timeout: 60000 })
    .then(() => true)
    .catch(() => false);
  ok('QR di depan kamera BENAR-BENAR terbaca (bukan sekadar pustakanya terpilih)', terbaca);

  await tunggu(1500);
  const jejak = sql(`
    SELECT coalesce(device_code, 'NULL') || '/' || coalesce(updated_by::text, 'NULL')
      FROM attendance a JOIN students s ON s.id = a.student_id
     WHERE s.nis = '${NIS_QR}' AND a.attendance_date = CURRENT_DATE`);
  ok('Scan kamera tercatat sebagai presensi SUNGGUHAN, bukan koreksi manual',
     jejak === 'NULL/NULL', `device_code/updated_by = ${jejak}`);
}

// ---------- Izin kamera ditolak ----------
const pTolak = await halamanKamera();
await pTolak.evaluateOnNewDocument(() => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      // Nama DOMException hanya bisa diatur lewat argumen kedua konstruktornya.
      getUserMedia: () => Promise.reject(new DOMException('Ditolak pengguna', 'NotAllowedError')),
      enumerateDevices: () => Promise.resolve([]),
    },
  });
});
await pTolak.goto(`${BASE}/scan`, { waitUntil: 'networkidle2' });
const adaPesanIzin = await pTolak
  .waitForFunction(() => /Izin kamera ditolak/.test(document.body.innerText), { timeout: 40000 })
  .then(() => true)
  .catch(() => false);
ok('Izin ditolak dijelaskan di Konsol Scan, bukan didiamkan', adaPesanIzin);
ok('Beserta cara memperbaikinya', /setelan situs|gembok/i.test(await teks(pTolak)));
await tangkapLayar(pTolak, '05-izin-ditolak');
await pTolak.close();

// ---------- Bukan HTTPS ----------
const pHttp = await halamanKamera();
await pHttp.evaluateOnNewDocument(() => {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
});
await pHttp.goto(`${BASE}/scan`, { waitUntil: 'networkidle2' });
const adaPesanHttps = await pHttp
  .waitForFunction(() => /bukan HTTPS/.test(document.body.innerText), { timeout: 40000 })
  .then(() => true)
  .catch(() => false);
ok('Alamat non-HTTPS dijelaskan, bukan gagal diam-diam', adaPesanHttps);
ok('Beserta anjuran memakai localhost', /localhost/.test(await teks(pHttp)));
await pHttp.close();

// ---------- Halaman Scanner: port dari agent ----------
await laporAgent([
  { path: '/dev/ttyUSB0', serialNumber: 'UJI-SN-0001', vendorId: '1a86', productId: '7523' },
  // Sengaja tanpa nomor seri: memancing peringatan pemetaan yang rapuh.
  { path: '/dev/ttyUSB1', vendorId: '1a86', productId: '7523' },
]);
await p.goto(`${BASE}/scanner`, { waitUntil: 'networkidle2' });
await p.waitForSelector('table tbody tr', { timeout: 40000 });
const jumlahPort = await p.$$eval('table tbody tr', (r) => r.length);
ok('Port yang dilaporkan agent tampil di halaman Scanner', jumlahPort >= 2, `${jumlahPort} port`);
ok('Port tanpa nomor seri diberi peringatan', /Tanpa nomor seri/i.test(await teks(p)));

// Dibersihkan: port palsu tidak boleh tertinggal di layar pengguna.
await laporAgent([]);
await p.evaluate(async () => {
  await fetch('http://localhost:4000/api/v1/scanners', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ scanners: [] }),
  });
});
const sisaPort = await p.evaluate(async () => {
  const res = await fetch('http://localhost:4000/api/v1/scanners', { credentials: 'include' });
  const d = (await res.json()).data;
  return [...d.terdeteksi, ...d.tidakTerdeteksi].length;
});
ok('Sisa uji dibersihkan — tidak ada port palsu tertinggal', sisaPort === 0, `${sisaPort} tersisa`);

ok('Tidak ada error JavaScript', p.galatJs.length === 0, p.galatJs.slice(0, 2).join(' | ') || 'bersih');

bersih();  // notify dikembalikan oleh pulihkanNanti()

const r = ringkas();
await browser.close();
process.exit(r.gagal ? 1 : 0);
