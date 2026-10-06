/**
 * Autentikasi & penjagaan sesi.
 *
 * Yang diuji di sini bukan "login berhasil" saja, tapi dua kegagalan yang
 * pernah benar-benar terjadi dan sulit didiagnosis:
 *
 *  - Cookie basi yang ditolak server membuat pengguna terpantul bolak-balik
 *    antara /login dan halaman terproteksi, layarnya cuma menampilkan kerangka
 *    pemuatan, dan satu-satunya petunjuk adalah 401 di konsol.
 *  - Halaman terproteksi yang dibuka tanpa sesi harus mengalihkan, bukan
 *    memunculkan layar kosong.
 */

import {
  BASE,
  buatPencatat,
  bukaBrowser,
  halamanBaru,
  isi,
  klik,
  masuk,
  tangkapLayar,
  teks,
  tunggu,
} from '../bersama.mjs';

const { ok, ringkas } = buatPencatat('Autentikasi');
const browser = await bukaBrowser();

/*
 * ---------- Password tidak boleh bocor ke URL ----------
 *
 * Cacat nyata yang ditemukan 13 September 2026 dan terlihat di log dev sebagai:
 *
 *   GET /login?username=superadmin&password=...
 *
 * Sebelum React terpasang, `onSubmit` belum terikat, jadi menekan Masuk (atau
 * Enter) menjalankan pengiriman form BAWAAN browser — dan form tanpa `action`
 * dikirim sebagai GET ke URL yang sama, sehingga passwordnya mendarat di query
 * string: tercatat di riwayat browser, bilah alamat, dan log server.
 *
 * Keadaan pra-hidrasi ditiru dengan mematikan JavaScript. Jendelanya memang
 * sempit di mesin cepat — tapi di laptop sekolah yang lambat, justru di situlah
 * pengguna yang tidak sabar menekan Enter.
 */
const praHidrasi = await halamanBaru(browser);
await praHidrasi.setJavaScriptEnabled(false);
await praHidrasi.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await tunggu(1000);

const bentukForm = await praHidrasi.evaluate(() => ({
  metode: (document.querySelector('form')?.getAttribute('method') ?? '').toLowerCase(),
  tombolMati: document.querySelector('button[type="submit"]')?.disabled === true,
}));
ok('Form login memakai method POST, bukan GET', bentukForm.metode === 'post',
   bentukForm.metode || '(tidak ada)');
ok('Tombol Masuk mati sebelum skripnya siap', bentukForm.tombolMati,
   'tombol submit yang mati juga menutup jalur Enter');

await praHidrasi.type('input[autocomplete="username"]', 'superadmin').catch(() => undefined);
await praHidrasi.type('input[autocomplete="current-password"]', 'siklon123').catch(() => undefined);
await praHidrasi.keyboard.press('Enter');
await tunggu(600);
await praHidrasi.click('button[type="submit"]').catch(() => undefined);
await tunggu(900);
ok('Password tidak pernah mendarat di URL, walau pengirimannya dipaksa',
   !/password=/.test(praHidrasi.url()), praHidrasi.url());
await praHidrasi.close();

// ---------- Masuk dengan sandi salah ----------
const p = await halamanBaru(browser);
await p.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await p.waitForSelector('input[autocomplete="username"]', { timeout: 90000 });
await isi(p, 'input[autocomplete="username"]', 'superadmin');
await isi(p, 'input[autocomplete="current-password"]', 'sandi-yang-salah');
await klik(p, 'Masuk', 'button', true);
const adaPesanSalah = await p
  .waitForFunction(
    () => /salah|tidak cocok|gagal/i.test(document.body.innerText),
    { timeout: 20000 },
  )
  .then(() => true)
  .catch(() => false);
ok('Sandi salah ditolak dengan pesan, bukan diam saja', adaPesanSalah);
ok('Tetap di halaman login', new URL(p.url()).pathname === '/login', p.url());

// ---------- Masuk benar ----------
await isi(p, 'input[autocomplete="current-password"]', 'siklon123');
await klik(p, 'Masuk', 'button', true);
const masukBerhasil = await p
  .waitForFunction(() => location.pathname === '/dashboard', { timeout: 60000 })
  .then(() => true)
  .catch(() => false);
ok('Sandi benar masuk ke dashboard', masukBerhasil);
ok('Identitas pengguna tampil di layar', /Super Admin/i.test(await teks(p)));

// ---------- Halaman terproteksi tanpa sesi ----------
const tamu = await halamanBaru(browser.constructor === Object ? browser : browser, {});
await tamu.deleteCookie(...(await tamu.cookies(BASE)));
await tamu.goto(`${BASE}/siswa`, { waitUntil: 'networkidle2' });
await tunggu(1500);
ok(
  'Halaman terproteksi tanpa sesi dialihkan ke login',
  new URL(tamu.url()).pathname === '/login',
  tamu.url(),
);
ok(
  'Tidak berhenti di layar kosong',
  (await teks(tamu)).trim().length > 40,
  `${(await teks(tamu)).trim().length} karakter`,
);
await tamu.close();

// ---------- Cookie basi: tidak boleh memantul selamanya ----------
const basi = await halamanBaru(browser);
await basi.setCookie({
  name: 'siklon_token',
  value: 'token.palsu.yang-ditolak-server',
  domain: 'localhost',
  path: '/',
});
await basi.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
const berhentiDiLogin = await basi
  .waitForFunction(() => location.pathname === '/login', { timeout: 25000 })
  .then(() => true)
  .catch(() => false);
ok('Cookie basi berakhir di login, bukan memantul tanpa henti', berhentiDiLogin, basi.url());

// Spanduk penjelasannya dirender React sesudah alihannya selesai — ditunggu,
// jangan dibaca seketika.
const adaPenjelasan = await basi
  .waitForFunction(() => /sesi anda sudah berakhir/i.test(document.body.innerText), { timeout: 20000 })
  .then(() => true)
  .catch(() => false);
ok(
  'Sebabnya dijelaskan, bukan dibiarkan menebak',
  adaPenjelasan,
  (await teks(basi)).split('\n').find((l) => /sesi/i.test(l))?.slice(0, 75) ?? '(tidak ada)',
);
await tangkapLayar(basi, '01-sesi-habis');
await basi.close();

// ---------- Keluar ----------
await p.bringToFront();
await masuk(p);
await klik(p, 'Super Administrator', 'button').catch(() => undefined);
await tunggu(600);
const adaKeluar = /Keluar/i.test(await teks(p));
ok('Menu pengguna memuat tombol Keluar', adaKeluar);

ok('Tidak ada error JavaScript', p.galatJs.length === 0, p.galatJs.slice(0, 2).join(' | ') || 'bersih');

const r = ringkas();
await browser.close();
process.exit(r.gagal ? 1 : 0);
