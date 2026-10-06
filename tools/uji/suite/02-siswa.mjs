/**
 * Master data siswa: daftar, pencarian, tambah/ubah, detail, dan impor Excel.
 *
 * Suite ini MENULIS ke database (menambah siswa uji, mengimpor berkas), jadi ia
 * membersihkan miliknya sendiri di awal DAN di akhir. Semua NIS uji berawalan
 * 'UJI' atau '9', tidak pernah menyentuh data sungguhan.
 */

import {
  BASE,
  angka,
  buatPencatat,
  bukaBrowser,
  halamanBaru,
  isi,
  klik,
  masuk,
  sqlJalan,
  tangkapLayar,
  teks,
  tunggu,
  tungguToastHilang,
} from '../bersama.mjs';
import { BERKAS, siapkanBerkas } from '../siapkan-berkas.mjs';

const { ok, ringkas } = buatPencatat('Siswa');
await siapkanBerkas();

const BERSIHKAN = `DELETE FROM students WHERE nis LIKE 'UJI%' OR nis LIKE '9%'`;
sqlJalan(BERSIHKAN);

const browser = await bukaBrowser();
const p = await halamanBaru(browser);
await masuk(p);

// ---------- Daftar & pencarian ----------
await p.goto(`${BASE}/siswa`, { waitUntil: 'networkidle2' });
await p.waitForSelector('table tbody tr', { timeout: 60000 });
const totalAktif = angka('SELECT count(*) FROM students WHERE is_active');
const barisAwal = await p.$$eval('table tbody tr', (r) => r.length);
// Tabelnya berhalaman, jadi yang benar min(total, ukuran halaman) — bukan angka tetap.
ok('Daftar siswa terisi dari database', barisAwal > 0 && barisAwal <= totalAktif,
   `${barisAwal} baris dari ${totalAktif} siswa aktif`);

const namaPertama = await p.$eval('table tbody tr', (r) => r.innerText.split('\n')[0].trim());
await isi(p, 'input[placeholder*="Cari" i], input[aria-label*="Cari" i]', namaPertama.slice(0, 5));
await tunggu(1200);
const barisCari = await p.$$eval('table tbody tr', (r) => r.length);
ok('Pencarian menyaring tabel', barisCari > 0 && barisCari <= barisAwal,
   `"${namaPertama.slice(0, 5)}" -> ${barisCari} baris`);
ok('Kata kunci pencarian tercatat di URL (bisa di-bookmark & di-Back)',
   /cari=/.test(p.url()), p.url());

// ---------- Tambah siswa ----------
await isi(p, 'input[placeholder*="Cari" i], input[aria-label*="Cari" i]', '');
await tunggu(800);
await tungguToastHilang(p);
await klik(p, 'Tambah Siswa');
await p.waitForSelector('[role="dialog"]', { timeout: 20000 });
await tunggu(600);

const NIS_UJI = `UJI${Date.now().toString().slice(-6)}`;
/*
 * Medan dipilih lewat atribut `name`, BUKAN `id`. FormField memakai id yang
 * dibangkitkan React (`_r_2k_`) — berubah tiap render dan tidak boleh dipatok.
 */
await isi(p, '[role="dialog"] input[name="full_name"]', 'Siswa Uji Otomatis');
await isi(p, '[role="dialog"] input[name="nis"]', NIS_UJI);
await klik(p, 'Tambah siswa', '[role="dialog"] button');
const tersimpan = await p
  .waitForFunction(() => /ditambahkan|disimpan/i.test(document.body.innerText), { timeout: 25000 })
  .then(() => true)
  .catch(() => false);
ok('Siswa baru tersimpan', tersimpan);
ok('Benar-benar masuk database', angka(`SELECT count(*) FROM students WHERE nis='${NIS_UJI}'`) === 1);

// ---------- Halaman detail ----------
const idUji = (await import('../bersama.mjs')).sql(`SELECT id FROM students WHERE nis='${NIS_UJI}'`);
await p.goto(`${BASE}/siswa/${idUji}`, { waitUntil: 'networkidle2' });
await p.waitForFunction(() => document.body.innerText.includes('Siswa Uji Otomatis'), { timeout: 30000 });
const isiDetail = await teks(p);
ok('Halaman detail memuat identitas siswa', /Siswa Uji Otomatis/.test(isiDetail) && isiDetail.includes(NIS_UJI));
ok('Kalender kehadiran digambar di halaman detail',
   (await p.$$eval('div', (d) => d.filter((x) => /aspect-square/.test(x.className)).length)) > 20);
ok('Nama wali TIDAK lagi diminta (kolomnya sudah dihapus)',
   !/nama wali/i.test(isiDetail), isiDetail.match(/.{0,25}wali.{0,25}/i)?.[0] ?? '(tidak disebut)');
await tangkapLayar(p, '02-detail-siswa');

// ---------- Impor: berkas bermasalah ----------
await p.goto(`${BASE}/siswa/import`, { waitUntil: 'networkidle2' });
await p.waitForSelector('input[type="file"]', { timeout: 60000 });
const sebelumImpor = angka('SELECT count(*) FROM students');

await (await p.$('input[type="file"]')).uploadFile(BERKAS.imporRusak);
await tunggu(600);
await klik(p, 'Periksa berkas');
await p.waitForFunction(() => /bermasalah/i.test(document.body.innerText), { timeout: 30000 });
await tunggu(700);
const isiRusak = await teks(p);
ok('Berkas bermasalah dilaporkan per baris', /Ada baris bermasalah/i.test(isiRusak));
ok('Tiap jenis masalah disebut sendiri',
   /NIS kosong/i.test(isiRusak) && /Nama siswa kosong/i.test(isiRusak) && /belum ada/i.test(isiRusak));
ok('Tidak ada data yang tersimpan saat berkas bermasalah',
   angka('SELECT count(*) FROM students') === sebelumImpor,
   `${sebelumImpor} -> ${angka('SELECT count(*) FROM students')}`);
const simpanMati = await p.evaluate(() =>
  [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Simpan ke database'))?.disabled);
ok('Tombol simpan terkunci selama masih ada error', simpanMati === true);
await tangkapLayar(p, '02-impor-bermasalah');

// ---------- Impor: berkas bersih ----------
await p.reload({ waitUntil: 'networkidle2' });
await p.waitForSelector('input[type="file"]', { timeout: 30000 });
await (await p.$('input[type="file"]')).uploadFile(BERKAS.imporBersih);
await tunggu(600);
await klik(p, 'Periksa berkas');
await p.waitForFunction(() => /Pemeriksaan lolos/i.test(document.body.innerText), { timeout: 30000 });
await klik(p, 'Simpan ke database');
await p.waitForFunction(() => /siswa diimpor|Siswa dibuat/i.test(document.body.innerText), { timeout: 30000 });
await tunggu(700);
const isiBersih = await teks(p);
ok('Berkas bersih tersimpan', /2 siswa diimpor/i.test(isiBersih),
   isiBersih.split('\n').find((l) => /diimpor/.test(l)) ?? '');
// "0812 9900 0001" dan "081299000001" adalah nomor yang SAMA.
ok('Dua tulisan nomor yang sama dihitung satu nomor',
   /1 nomor berbeda/i.test(isiBersih),
   isiBersih.split('\n').find((l) => /nomor berbeda/.test(l)) ?? '');
ok('Keduanya benar-benar masuk database',
   angka(`SELECT count(*) FROM students WHERE nis IN ('9101','9102')`) === 2);

ok('Tidak ada error JavaScript', p.galatJs.length === 0, p.galatJs.slice(0, 2).join(' | ') || 'bersih');

sqlJalan(BERSIHKAN);
const r = ringkas();
await browser.close();
process.exit(r.gagal ? 1 : 0);
