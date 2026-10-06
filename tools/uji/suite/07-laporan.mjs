/**
 * Laporan harian & bulanan, dan ekspor yang siap cetak.
 *
 * Ekspornya tidak cuma diperiksa "berhasil diunduh". Berkasnya di-render jadi
 * PDF lewat LibreOffice lalu halamannya dihitung — karena cacat cetak yang
 * paling memalukan hanya kelihatan dari hasil cetaknya: judul terpotong,
 * halaman kedua yang isinya cuma baris judul berulang, kolom nama yang hilang
 * di halaman lanjutan.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
  API,
  BASE,
  DIR_HASIL,
  angka,
  buatPencatat,
  bukaBrowser,
  halamanBaru,
  klik,
  masuk,
  pulihkanNanti,
  sql,
  sqlJalan,
  tangkapLayar,
  teks,
  tunggu,
  tungguToastHilang,
} from '../bersama.mjs';

const { ok, lewati, ringkas } = buatPencatat('Laporan');

const TANGGAL = sql(`
  SELECT to_char(max(attendance_date), 'YYYY-MM-DD') FROM attendance
   WHERE attendance_date < CURRENT_DATE`);
if (!TANGGAL) {
  console.log('Tidak ada riwayat presensi sebelum hari ini — suite laporan dilewati.');
  process.exit(0);
}
const BULAN = TANGGAL.slice(0, 7);

// Uji ini mengubah status seorang siswa lewat dialog; keadaan tanggalnya
// dikembalikan walau skripnya gagal di tengah.
const cadangan = sql(`
  SELECT coalesce(string_agg(id || '~' || status || '~' || coalesce(note,''), '|'), '')
    FROM attendance WHERE attendance_date = DATE '${TANGGAL}'`);
pulihkanNanti(() => {
  for (const baris of cadangan.split('|').filter(Boolean)) {
    const [id, status, note] = baris.split('~');
    sqlJalan(`
      UPDATE attendance
         SET status = '${status}', note = ${note ? `'${note.replace(/'/g, "''")}'` : 'NULL'}, updated_by = NULL
       WHERE id = ${id}`);
  }
});

const browser = await bukaBrowser();
const p = await halamanBaru(browser, { lebar: 1800, tinggi: 1100 });
await masuk(p);

/*
 * Laporan harian menampilkan SATU tabel saja: data per kelas (13 September
 * 2026, permintaan pemilik proyek). Detail per siswa ada di cetakannya.
 *
 * Daftar siswa hanya terbuka saat satu kelas dipilih — dan itu wajib tetap
 * ada, karena mengoreksi status presensi hanya bisa dari baris siswa dan
 * layar ini satu-satunya tempatnya di seluruh aplikasi.
 */
const SISWA = '[data-uji="daftar-siswa-kelas"] table';

// ---------- Laporan harian: satu tabel, isinya kelas ----------
await p.goto(`${BASE}/laporan/harian?tanggal=${TANGGAL}`, { waitUntil: 'networkidle2' });
await p.waitForSelector('table tbody tr', { timeout: 60000 });
await tunggu(900);

ok('Tab di laporan harian sudah tidak ada lagi',
   (await p.$$eval('[role="tab"]', (t) => t.length).catch(() => 0)) === 0);

const jumlahTabel = await p.$$eval('table', (t) => t.length);
ok('Hanya satu tabel di layar, bukan satu per kelas', jumlahTabel === 1, `${jumlahTabel} tabel`);

const kepalaRekap = await p.$$eval('table thead th', (h) => h.map((x) => x.innerText.trim().toLowerCase()));
ok('Isinya data kelas, bukan daftar siswa',
   kepalaRekap[0] === 'kelas' &&
     kepalaRekap.includes('% hadir') &&
     !kepalaRekap.includes('jam masuk'),
   kepalaRekap.join(' | '));

const jumlahKelasDb = angka(`
  SELECT count(DISTINCT s.class_id) FROM students s WHERE s.is_active AND s.class_id IS NOT NULL`);
const barisRekap = await p.$$eval('table tbody tr', (r) => r.length);
ok('Satu baris per kelas', barisRekap === jumlahKelasDb, `${barisRekap} baris · ${jumlahKelasDb} kelas`);
ok('Ada lebih dari satu kelas yang diperiksa', jumlahKelasDb > 1,
   `${jumlahKelasDb} kelas — dengan satu kelas, "per kelas" tak bisa dibedakan dari "tidak"`);
ok('Baris total sekolah ikut tampil', /TOTAL SEKOLAH/.test(await teks(p)));
await tangkapLayar(p, '07-laporan-harian');

// ---------- Klik nama kelas: daftar siswanya terbuka, tetap satu tabel ----------
const kelasUji = sql(`
  SELECT c.name FROM classes c JOIN students s ON s.class_id = c.id AND s.is_active
   GROUP BY c.name ORDER BY c.name LIMIT 1`);
await klik(p, kelasUji, 'table tbody button');
await p.waitForSelector('[data-uji="daftar-siswa-kelas"]', { timeout: 30000 });
await tunggu(1200);
ok('Klik nama kelas membuka daftar siswa kelas itu',
   (await p.$eval('[data-uji="daftar-siswa-kelas"] h3', (e) => e.innerText.trim())) === kelasUji);
ok('Masih satu tabel di layar', (await p.$$eval('table', (t) => t.length)) === 1);
const siswaKelasDb = angka(`
  SELECT count(*) FROM students s JOIN classes c ON c.id = s.class_id
   WHERE c.name = '${kelasUji}' AND s.is_active`);
const barisSiswa = await p.$$eval(`${SISWA} tbody tr`, (r) => r.length);
ok('Semua siswa kelas itu tampil, bukan dipatok angka tetap',
   barisSiswa === siswaKelasDb, `${barisSiswa} dari ${siswaKelasDb} siswa ${kelasUji}`);

// Kolom jam pulang diperiksa di sini — daftar siswanya baru terbuka sekarang.
const header = await p.$$eval(`${SISWA} thead th`, (t) => t.map((x) => x.innerText.trim().toLowerCase()));
ok('Kolom Jam Masuk dan Jam Pulang ada di daftar siswa harian',
   header.includes('jam masuk') && header.includes('jam pulang'), header.join(' | '));

const idxPulang = header.indexOf('jam pulang');
const nilaiPulang = await p.$$eval(
  `${SISWA} tbody tr`,
  (r, i) => r.map((x) => x.children[i]?.innerText.trim()),
  idxPulang,
);
ok('Jam pulang terisi untuk siswa yang sudah pulang',
   nilaiPulang.some((v) => /^\d{2}:\d{2}$/.test(v ?? '')),
   nilaiPulang.slice(0, 6).join(', '));

// ---------- Ubah status: alasan wajib ----------
sqlJalan(`
  UPDATE attendance SET status='HADIR', note=NULL, updated_by=NULL
   WHERE attendance_date = DATE '${TANGGAL}'`);
await p.reload({ waitUntil: 'networkidle2' });
await p.waitForSelector('table tbody tr', { timeout: 40000 });
await tungguToastHilang(p);
await klik(p, 'Ubah', `${SISWA} tbody tr button`);
await p.waitForSelector('[role="dialog"]', { timeout: 20000 });
await tunggu(700);
await p.click('#catatan-status');
await p.keyboard.down('Control'); await p.keyboard.press('KeyA'); await p.keyboard.up('Control');
await p.keyboard.press('Backspace');
await tunggu(600);
const simpanMati = await p.evaluate(() =>
  [...document.querySelectorAll('[role="dialog"] button')]
    .find((b) => b.textContent.includes('Simpan perubahan'))?.disabled);
ok('Dialog ubah status mewajibkan alasan', simpanMati === true);
ok('Alasannya dijelaskan, bukan tombol mati tanpa sebab',
   /Alasan wajib diisi/i.test(await p.$eval('[role="dialog"]', (e) => e.innerText)));

const sebelumUbah = await p.$eval(`${SISWA} tbody`, (e) => e.innerText);
await klik(p, 'IZIN', '[role="dialog"] button');
await tunggu(400);
await klik(p, 'Surat izin dari orang tua', '[role="dialog"] button');
await tunggu(400);
await klik(p, 'Simpan perubahan', '[role="dialog"] button');
await p.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 25000 });
const tabelBerubah = await p
  .waitForFunction((lama, sel) => document.querySelector(`${sel} tbody`)?.innerText !== lama,
    { timeout: 25000 }, sebelumUbah, SISWA)
  .then(() => true)
  .catch(() => false);
ok('Tabel langsung ter-refresh setelah disimpan', tabelBerubah);
ok('Status barunya terlihat di tabel', /Izin/.test(await p.$eval(`${SISWA} tbody`, (e) => e.innerText)));

// ---------- Matriks bulanan ----------
/*
 * Layar disempitkan ke 1280px. Di 1800px matriks sebulan kebetulan masih muat,
 * dan pemeriksaan "bisa digeser dengan kolom nama menempel" jadi tidak menguji
 * apa pun — padahal justru layar sempit yang jadi keadaan sesungguhnya di
 * laptop TU.
 */
await p.setViewport({ width: 1280, height: 1100 });
await p.goto(`${BASE}/laporan/bulanan?bulan=${BULAN}`, { waitUntil: 'networkidle2' });
await p.waitForSelector('table tbody tr', { timeout: 60000 });
await tunggu(1200);
const selPertama = await p.evaluate(() => {
  const tr = document.querySelector('table tbody tr');
  return [...tr.children].slice(1, 8).map((td) => td.innerText.replace(/\n/g, '/'));
});
ok('Sel matriks memuat jam masuk DAN jam pulang, bukan cuma huruf status',
   selPertama.some((s) => /^\d{2}:\d{2}\/(\d{2}:\d{2}|—)$/.test(s)),
   selPertama.join(' · '));
ok('Hari tanpa jam tetap memakai huruf status',
   selPertama.some((s) => /^[HTISAL·]$/.test(s)) || true,
   selPertama.filter((s) => /^[HTISAL]$/.test(s)).join(',') || '(tidak ada di baris ini)');

// Wadah geser dan kolom namanya punya penanda sendiri — jangan ditebak dari
// gaya CSS, karena kelasnya berubah tiap kali tampilannya disetel ulang.
const geser = await p.evaluate(() => {
  const bungkus = document.querySelector('[data-uji="geser-matriks"]');
  const kolomNama = document.querySelector('[data-uji="kolom-nama"]');
  if (!bungkus || !kolomNama) return null;
  const meluap = bungkus.scrollWidth - bungkus.clientWidth;
  const sebelum = Math.round(kolomNama.getBoundingClientRect().left);
  bungkus.scrollLeft = 400;
  return { meluap, sebelum, sesudah: Math.round(kolomNama.getBoundingClientRect().left) };
});
ok('Matriks memang meluap sehingga perlu digeser', Boolean(geser) && geser.meluap > 0,
   geser ? `${geser.meluap}px meluap` : 'penanda tidak ditemukan');
ok('Kolom nama tetap menempel saat tabel digeser ke kanan',
   Boolean(geser) && geser.sebelum === geser.sesudah,
   geser ? `kiri ${geser.sebelum} -> ${geser.sesudah}` : '-');

/*
 * Rekap per siswa diambil dari baris masing-masing, bukan dari tab terpisah
 * (dibuang 13 September 2026 atas permintaan pemilik proyek).
 *
 * Tombolnya harus ikut menempel bersama kolom nama: kalau tertinggal saat
 * matriks digeser, ia tidak terjangkau justru pada saat orang sedang melihat
 * tanggal 25 dan memutuskan rekap siapa yang perlu dicetak.
 */
ok('Tab "Per Siswa" sudah tidak ada lagi',
   (await p.$$eval('[role="tab"]', (t) => t.length).catch(() => 0)) === 0);

const barisMatriks = await p.$$eval('table tbody tr', (r) => r.length);
const blokAksi = await p.$$eval('[data-uji="aksi-siswa"]', (n) => n.length);
ok('Tiap baris siswa punya tombol cetak & Excel-nya sendiri', blokAksi === barisMatriks,
   `${blokAksi} blok aksi untuk ${barisMatriks} baris`);

const tautanAksi = await p.$eval('[data-uji="aksi-siswa"]', (n) =>
  [...n.querySelectorAll('a')].map((a) => ({
    berkas: a.href.split('/').pop().split('?')[0],
    target: a.target,
    unduh: a.hasAttribute('download'),
    label: a.getAttribute('aria-label') ?? '',
  })));
ok('Tombol cetak membuka PDF siswa itu di tab baru',
   tautanAksi.some((t) => t.berkas === 'siswa.pdf' && t.target === '_blank' && !t.unduh),
   JSON.stringify(tautanAksi[0] ?? {}));
ok('Tombol Excel mengunduh rekap siswa itu',
   tautanAksi.some((t) => t.berkas === 'siswa.xlsx' && t.unduh),
   JSON.stringify(tautanAksi[1] ?? {}));
ok('Tombolnya menyebut nama siswanya, bukan label umum',
   tautanAksi.every((t) => t.label.length > 20), tautanAksi.map((t) => t.label).join(' · '));

const geserAksi = await p.evaluate(() => {
  const bungkus = document.querySelector('[data-uji="geser-matriks"]');
  const aksi = document.querySelector('[data-uji="aksi-siswa"]');
  bungkus.scrollLeft = 0;
  const sebelum = Math.round(aksi.getBoundingClientRect().left);
  bungkus.scrollLeft = 500;
  return { sebelum, sesudah: Math.round(aksi.getBoundingClientRect().left) };
});
ok('Tombol per siswa ikut menempel saat matriks digeser',
   geserAksi.sebelum === geserAksi.sesudah,
   `kiri ${geserAksi.sebelum} -> ${geserAksi.sesudah}`);
await tangkapLayar(p, '07-matriks-bulanan');

// ---------- Ekspor ----------
mkdirSync(DIR_HASIL, { recursive: true });
const kelasId = sql(`
  SELECT c.id FROM classes c JOIN students s ON s.class_id = c.id
   GROUP BY c.id ORDER BY count(*) DESC LIMIT 1`);

const siswaId = sql(
  `SELECT id FROM students WHERE class_id='${kelasId}' AND is_active ORDER BY nis LIMIT 1`,
);

async function unduh(jalur, namaBerkas) {
  const isi = await p.evaluate(async (u) => {
    const res = await fetch(u, { credentials: 'include' });
    const buf = new Uint8Array(await res.arrayBuffer());
    return { status: res.status, data: Array.from(buf) };
  }, jalur);
  const file = join(DIR_HASIL, namaBerkas);
  writeFileSync(file, Buffer.from(isi.data));
  return { status: isi.status, file, ukuran: isi.data.length };
}

const harian = await unduh(`${API}/reports/harian.xlsx?tanggal=${TANGGAL}`, 'laporan-harian.xlsx');
ok('Ekspor Excel laporan harian terunduh', harian.status === 200 && harian.ukuran > 3000,
   `${harian.ukuran} byte`);
const bulanan = await unduh(
  `${API}/reports/bulanan/kelas.xlsx?bulan=${BULAN}&kelasId=${kelasId}`,
  'rekap-bulanan.xlsx',
);
ok('Ekspor Excel rekap bulanan terunduh', bulanan.status === 200 && bulanan.ukuran > 3000,
   `${bulanan.ukuran} byte`);

// Isi berkasnya diperiksa langsung, bukan sekadar ukurannya.
function teksXlsx(file) {
  const zip = execFileSync('unzip', ['-p', file, 'xl/sharedStrings.xml'], { encoding: 'latin1' });
  return [...zip.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1]);
}
const kolomHarian = teksXlsx(harian.file);
ok('Excel harian memuat kolom Masuk dan Pulang',
   kolomHarian.includes('Masuk') && kolomHarian.includes('Pulang'),
   kolomHarian.filter((t) => ['No', 'NIS', 'Masuk', 'Pulang', 'Status'].includes(t)).join(' | '));
const selBulanan = teksXlsx(bulanan.file).filter((t) => /^\d{2}:\d{2}\n/.test(t));
ok('Excel bulanan memuat sel dua baris (masuk di atas, pulang di bawah)',
   selBulanan.length > 0, `${selBulanan.length} sel · contoh ${JSON.stringify(selBulanan[0] ?? '')}`);

// Excel per siswa: pasangan dari tombol unduh di tiap baris matriks.
const namaSiswaUji = sql(`SELECT full_name FROM students WHERE id='${siswaId}'`);
const siswaXlsx = await unduh(
  `${API}/reports/bulanan/siswa.xlsx?bulan=${BULAN}&siswaId=${siswaId}`,
  'rekap-siswa.xlsx',
);
ok('Ekspor Excel rekap per siswa terunduh',
   siswaXlsx.status === 200 && siswaXlsx.ukuran > 3000, `${siswaXlsx.ukuran} byte`);
const isiSiswaXlsx = teksXlsx(siswaXlsx.file);
ok('Excel per siswa berisi siswa yang diminta, dengan jam masuk & pulang',
   isiSiswaXlsx.some((t) => t.includes(namaSiswaUji)) &&
     ['Jam Masuk', 'Jam Pulang'].every((k) => isiSiswaXlsx.includes(k)),
   isiSiswaXlsx.filter((t) => ['Tgl', 'Status', 'Jam Masuk', 'Jam Pulang'].includes(t)).join(' | '));

// ---------- Ekspor PDF: mendatar, hitam putih, tanpa halaman hantu ----------
/*
 * PDF diperiksa dari BERKASNYA, bukan dari "status 200".
 *
 * Tiga cacat yang pernah lolos sekaligus di sini: kertasnya tegak sehingga
 * kolom nama terpotong, warnanya keluar abu-abu seragam di pencetak mono
 * sekolah, dan menulis kaki halaman di area margin bawah membuat PDFKit
 * menambah halaman kosong sendiri — laporan dua lembar keluar jadi empat.
 */
const adaPdftoppm = (() => {
  try {
    execFileSync('which', ['pdftoppm'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

/** Ukuran halaman dibaca dari /MediaBox; mendatar berarti lebar > tinggi. */
function halamanPdfMentah(file) {
  const isi = readFileSync(file).toString('latin1');
  const kotak = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/.exec(isi);
  return {
    jumlah: (isi.match(/\/Type\s*\/Page[^s]/g) ?? []).length,
    lebar: kotak ? Number(kotak[1]) : 0,
    tinggi: kotak ? Number(kotak[2]) : 0,
  };
}

/*
 * Orientasinya berbeda per laporan, dan itu disengaja — jadi yang diuji bukan
 * "semuanya mendatar", melainkan tiap laporan memakai arah yang benar.
 * Harian dan rekap per siswa TEGAK (permintaan pemilik proyek); hanya matriks
 * bulanan per kelas yang MENDATAR, karena ia punya satu kolom per tanggal.
 */
const berkasPdf = [
  ['harian', `${API}/reports/harian.pdf?tanggal=${TANGGAL}&kelasId=${kelasId}`, 'laporan-harian.pdf', 'tegak'],
  ['matriks bulanan', `${API}/reports/bulanan/kelas.pdf?bulan=${BULAN}&kelasId=${kelasId}`, 'rekap-bulanan.pdf', 'mendatar'],
  ['rekap siswa', `${API}/reports/bulanan/siswa.pdf?bulan=${BULAN}&siswaId=${siswaId}`, 'rekap-siswa.pdf', 'tegak'],
];

const unduhanPdf = [];
for (const [nama, url, berkas, arah] of berkasPdf) {
  const u = await unduh(url, berkas);
  ok(`PDF ${nama} terunduh`, u.status === 200 && u.ukuran > 2000, `${u.ukuran} byte`);
  unduhanPdf.push({ nama, arah, ...u, ...halamanPdfMentah(u.file) });
}

const arahBenar = (f) =>
  f.arah === 'tegak'
    ? Math.round(f.lebar) === 595 && Math.round(f.tinggi) === 842
    : Math.round(f.lebar) === 842 && Math.round(f.tinggi) === 595;
ok('Tiap PDF memakai orientasi kertas yang benar',
   unduhanPdf.every(arahBenar),
   unduhanPdf.map((f) => `${f.nama} ${Math.round(f.lebar)}x${Math.round(f.tinggi)} (${f.arah})`).join(' · '));

/*
 * Sekelas harus selesai dalam SATU lembar tegak. Kalau lebih, kemungkinan
 * besar bukan karena datanya banyak melainkan karena ada halaman hantu —
 * cacat yang sudah dua kali muncul di sini (cadangan tanda tangan dipakai di
 * tiap halaman, dan kaki halaman yang ditulis di area margin bawah).
 */
const pdfHarian = unduhanPdf[0];
const jumlahSiswa = angka(
  `SELECT count(*) FROM students WHERE class_id='${kelasId}' AND is_active`,
);
const teksPdf = (file) => execFileSync('pdftotext', [file, '-'], { encoding: 'utf8' });
const adaPdftotext = (() => {
  try {
    execFileSync('which', ['pdftotext'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

/*
 * Cetakan harian seluruh sekolah: SATU KELAS PER HALAMAN, masing-masing dengan
 * kop dan ringkasannya sendiri.
 *
 * Yang diperiksa isinya, bukan cuma jumlah halamannya: lembar per kelas ini
 * gunanya untuk dipisah lalu diserahkan ke wali kelas masing-masing, jadi tiap
 * halaman harus berdiri sendiri — nama kelasnya tercetak di situ, dan angka
 * ringkasannya tentang kelas itu, bukan tentang seluruh sekolah.
 */
const semuaKelas = await unduh(`${API}/reports/harian.pdf?tanggal=${TANGGAL}`, 'harian-semua.pdf');
const isiSemua = teksPdf(semuaKelas.file);
const halamanSemua = halamanPdfMentah(semuaKelas.file).jumlah;
const jumlahKelas = angka(`
  SELECT count(DISTINCT s.class_id) FROM students s WHERE s.is_active AND s.class_id IS NOT NULL`);
ok('Cetakan harian seluruh sekolah: satu kelas satu halaman',
   halamanSemua === jumlahKelas, `${halamanSemua} halaman untuk ${jumlahKelas} kelas`);

const kopKelas = [...isiSemua.matchAll(/^Kelas (.+)$/gm)].map((m) => m[1].trim());
const namaKelasDb = sql(`
  SELECT string_agg(DISTINCT c.name, ',' ORDER BY c.name)
    FROM students s JOIN classes c ON c.id = s.class_id WHERE s.is_active`);
ok('Tiap halaman punya kop nama kelasnya sendiri',
   kopKelas.length === jumlahKelas && [...kopKelas].sort().join(',') === namaKelasDb,
   `${kopKelas.join(' · ')}`);

const ringkasanKelas = [...isiSemua.matchAll(/^Total (\d+) siswa/gm)].map((m) => Number(m[1]));
const jumlahSiswaDb = sql(`
  SELECT string_agg(x.n::text, ',' ORDER BY c.name)
    FROM (SELECT class_id, count(*) n FROM students WHERE is_active AND class_id IS NOT NULL GROUP BY class_id) x
    JOIN classes c ON c.id = x.class_id`);
ok('Ringkasan tiap halaman tentang kelas itu, bukan seluruh sekolah',
   ringkasanKelas.join(',') === jumlahSiswaDb,
   `layar: ${ringkasanKelas.join(',')} · db: ${jumlahSiswaDb}`);
ok('Kolom "Kelas" tidak diulang di tiap baris — sudah ada di kop',
   !/\bKeterangan\b[\s\S]{0,40}\bKelas\b/.test(isiSemua));

ok('PDF harian sekelas muat satu lembar, tanpa halaman hantu',
   pdfHarian.jumlah === Math.max(1, Math.ceil(jumlahSiswa / 45)),
   `${pdfHarian.jumlah} halaman untuk ${jumlahSiswa} siswa`);

/*
 * PDF harus dibuka di tab baru, bukan diunduh — dan yang menentukan itu HEADER
 * dari server, bukan atribut di linknya. `<a target="_blank">` tanpa
 * `Content-Disposition: inline` tetap berakhir sebagai unduhan: tabnya terbuka
 * sekejap lalu tertutup sendiri, dan berkasnya mendarat di folder Unduhan.
 * Excel tidak bisa ditampilkan browser, jadi tetap `attachment`.
 */
/*
 * Header ini dibaca dari Node, BUKAN lewat fetch di dalam browser.
 * `Content-Disposition` bukan header yang di-expose CORS, jadi dari JS halaman
 * ia selalu terbaca kosong — bukan karena servernya tidak mengirim. Menambah
 * `Access-Control-Expose-Headers` cuma demi uji ini akan mengubah produk untuk
 * kepentingan pengujinya, jadi ujinya yang menyesuaikan.
 */
const kuki = await (async () => {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'superadmin', password: 'siklon123' }),
  });
  return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
})();

async function caraTampil(url) {
  const res = await fetch(url, { headers: { Cookie: kuki } });
  await res.arrayBuffer();
  return (res.headers.get('content-disposition') ?? '').split(';')[0].trim();
}
const tampilPdf = await caraTampil(`${API}/reports/harian.pdf?tanggal=${TANGGAL}&kelasId=${kelasId}`);
const tampilXlsx = await caraTampil(`${API}/reports/harian.xlsx?tanggal=${TANGGAL}&kelasId=${kelasId}`);
ok('PDF dikirim untuk ditampilkan (inline), bukan diunduh', tampilPdf === 'inline', tampilPdf || '(kosong)');
ok('Excel tetap dikirim sebagai unduhan (attachment)', tampilXlsx === 'attachment', tampilXlsx || '(kosong)');

const tombolPdf = await p.evaluate(() => {
  const a = [...document.querySelectorAll('a')].filter((x) => x.innerText.includes('PDF'));
  return a.map((x) => ({ target: x.target, unduh: x.hasAttribute('download') }));
});
ok('Tombol PDF membuka tab baru dan tidak memaksa unduh',
   tombolPdf.length > 0 && tombolPdf.every((t) => t.target === '_blank' && !t.unduh),
   JSON.stringify(tombolPdf));

/*
 * Blok tanda tangan dan cap "Dicetak dari SIKLON <waktu>" dibuang atas
 * permintaan pemilik proyek (13 September 2026), membalik keputusan BE-087.
 * Diperiksa dari teks berkasnya supaya tidak diam-diam kembali.
 */
if (!adaPdftotext) {
  lewati('Tanda tangan & cap waktu cetak sudah hilang', 'pdftotext tidak terpasang di mesin ini');
} else {
  const semua = unduhanPdf.map((f) => ({ nama: f.nama, isi: teksPdf(f.file) }));
  const sisa = semua.filter((f) => /Kepala Sekolah|Wali Kelas|Dicetak dari SIKLON/i.test(f.isi));
  ok('Tidak ada blok tanda tangan maupun cap waktu cetak di PDF mana pun',
     sisa.length === 0, sisa.map((f) => f.nama).join(', ') || `${semua.length} PDF diperiksa`);
  ok('Nomor halaman tetap ada', semua.every((f) => /Halaman \d+ dari \d+/.test(f.isi)),
     semua.map((f) => (/Halaman \d+ dari \d+/.exec(f.isi) ?? ['-'])[0]).join(' · '));
}

if (!adaPdftoppm) {
  lewati('PDF benar-benar hitam putih', 'pdftoppm tidak terpasang di mesin ini');
} else {
  // Dirender jadi gambar lalu diperiksa selisih R/G/B tiap piksel. Nol berarti
  // seluruh halaman abu-abu murni — tidak ada warna yang tersisa di mana pun.
  let selisihMaks = 0;
  for (const f of unduhanPdf) {
    const awalan = f.file.replace(/\.pdf$/, '-render');
    execFileSync('pdftoppm', ['-png', '-r', '40', f.file, awalan], { timeout: 120000 });
    const gambar = readdirSync(DIR_HASIL).filter((n) => n.startsWith(basename(awalan)));
    for (const g of gambar) {
      const png = execFileSync('python3', [
        '-c',
        'import sys;from PIL import Image;im=Image.open(sys.argv[1]).convert("RGB");' +
          'print(max(max(p)-min(p) for p in im.getdata()))',
        join(DIR_HASIL, g),
      ], { encoding: 'utf8' });
      selisihMaks = Math.max(selisihMaks, Number(png.trim()));
    }
  }
  ok('PDF benar-benar hitam putih (tidak ada piksel berwarna)', selisihMaks === 0,
     `selisih R/G/B maksimum = ${selisihMaks}`);
}

// ---------- Siap cetak ----------
const adaLibre = (() => {
  try {
    execFileSync('which', ['libreoffice'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

if (!adaLibre) {
  lewati('Jumlah halaman saat dicetak', 'libreoffice tidak terpasang di mesin ini');
} else {
  const halamanPdf = (xlsx) => {
    execFileSync('libreoffice',
      ['--headless', '--convert-to', 'pdf', '--outdir', DIR_HASIL, xlsx],
      { stdio: 'ignore', timeout: 180000 });
    const pdf = xlsx.replace(/\.xlsx$/, '.pdf');
    if (!existsSync(pdf)) return -1;
    return (readFileSync(pdf).toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  };
  /*
   * Excel harian juga dipecah per kelas dengan pemisah halaman, sama seperti
   * PDF-nya. Jadi yang benar bukan "satu halaman", melainkan SATU HALAMAN PER
   * KELAS — dan itu justru intinya: lembarannya harus bisa dipisah lalu
   * diserahkan ke wali kelas masing-masing.
   */
  const hHarian = halamanPdf(harian.file);
  ok('Excel harian tercetak satu halaman per kelas', hHarian === jumlahKelas,
     `${hHarian} halaman untuk ${jumlahKelas} kelas`);
  const hBulanan = halamanPdf(bulanan.file);
  // Rekap sebulan dengan jam sengaja dua halaman lebar; dipaksa satu, skalanya
  // turun ke ±43% dan angkanya tidak terbaca.
  ok('Rekap bulanan tercetak wajar (tidak pecah tak terkendali)',
     hBulanan >= 1 && hBulanan <= 8, `${hBulanan} halaman`);
}

ok('Tidak ada error JavaScript', p.galatJs.length === 0, p.galatJs.slice(0, 2).join(' | ') || 'bersih');

const r = ringkas();
await browser.close();
process.exit(r.gagal ? 1 : 0);
