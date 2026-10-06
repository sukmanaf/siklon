/**
 * Kesiapan rilis: responsif, ketahanan saat API mati, dan mode kiosk.
 *
 * Dua hal yang dijaga di sini pernah benar-benar bocor:
 *
 *  - Kartu yang meluap di layar HP baru terlihat SESUDAH ada data. Selama
 *    datanya kosong, kartunya kosong dan tidak pernah meluap — jadi halaman
 *    diperiksa dalam keadaan berisi, bukan kosong.
 *  - Saat API mati, halaman tidak boleh jadi layar putih. Petugas harus tahu
 *    penyebabnya, bukan menatap layar kosong.
 */

import {
  BASE,
  buatPencatat,
  bukaBrowser,
  halamanBaru,
  klik,
  masuk,
  tangkapLayar,
  teks,
  tunggu,
} from '../bersama.mjs';

const { ok, ringkas } = buatPencatat('Rilis');

const HALAMAN = [
  '/dashboard', '/siswa', '/siswa/import', '/kelas', '/scan', '/scanner',
  '/whatsapp', '/laporan/harian', '/laporan/bulanan', '/pengaturan', '/pengguna',
];

const browser = await bukaBrowser();

// ---------- Responsif ----------
for (const [nama, lebar, tinggi] of [['HP', 390, 844], ['Tablet', 820, 1180]]) {
  const p = await halamanBaru(browser, { lebar, tinggi });
  await masuk(p);

  const meluap = [];
  for (const rute of HALAMAN) {
    await p.goto(`${BASE}${rute}`, { waitUntil: 'networkidle2' });
    await p
      .waitForFunction(() => document.body.innerText.trim().length > 40, { timeout: 45000 })
      .catch(() => undefined);
    await tunggu(1100);
    const l = await p.evaluate(() => ({
      dok: document.documentElement.scrollWidth,
      layar: window.innerWidth,
    }));
    // Toleransi 2px untuk pembulatan sub-piksel.
    if (l.dok > l.layar + 2) meluap.push(`${rute} (${l.dok}>${l.layar})`);
  }
  ok(`${nama} ${lebar}px: tidak ada halaman yang meluap mendatar`, meluap.length === 0,
     meluap.join(', ') || `${HALAMAN.length} halaman diperiksa`);

  if (nama === 'HP') {
    await p.goto(`${BASE}/scan`, { waitUntil: 'networkidle2' });
    await tunggu(1500);
    ok('Di HP, sidebar jadi laci dengan tombol menu',
       (await p.$('button[aria-label="Buka menu"]')) !== null);
    await tangkapLayar(p, '08-hp-konsol-scan');
  }
  ok(`${nama}: tidak ada error JavaScript`, p.galatJs.length === 0,
     p.galatJs.slice(0, 2).join(' | ') || 'bersih');
  await p.close();
}

// ---------- API mati total ----------
const pMati = await halamanBaru(browser);
await masuk(pMati);
await pMati.setRequestInterception(true);
pMati.on('request', (r) => {
  if (r.url().includes(':4000')) void r.abort('failed');
  else void r.continue();
});

const kosong = [];
for (const rute of HALAMAN) {
  await pMati.goto(`${BASE}${rute}`, { waitUntil: 'domcontentloaded' });
  await tunggu(2800);
  const isi = await pMati.evaluate(() => document.body.innerText.trim());
  if (isi.length < 40) kosong.push(`${rute} (${isi.length} karakter)`);
}
ok('API mati: tidak ada halaman yang jadi layar putih kosong', kosong.length === 0,
   kosong.join(', ') || `${HALAMAN.length} halaman diperiksa`);
ok('API mati: penyebabnya dijelaskan di layar',
   /tidak (dapat|bisa) menghubungi server/i.test(await teks(pMati)),
   (await teks(pMati)).split('\n').find((l) => /server/i.test(l))?.slice(0, 70) ?? '');
await tangkapLayar(pMati, '08-api-mati');
await pMati.close();

// ---------- Hanya data halaman yang gagal ----------
// Sesi dibiarkan hidup (/auth/ lolos) supaya yang teruji adalah keadaan error
// milik tiap halaman, bukan penjaga sesi di layout.
const pSebagian = await halamanBaru(browser);
await masuk(pSebagian);
await pSebagian.setRequestInterception(true);
pSebagian.on('request', (r) => {
  const u = r.url();
  if (u.includes(':4000') && !u.includes('/auth/')) void r.abort('failed');
  else void r.continue();
});

const tanpaPesan = [];
for (const rute of HALAMAN) {
  await pSebagian.goto(`${BASE}${rute}`, { waitUntil: 'domcontentloaded' });
  const adaPenjelasan = await pSebagian
    .waitForFunction(
      () => /gagal dimuat|tidak bisa dimuat|tidak dapat menghubungi|coba lagi/i.test(document.body.innerText),
      { timeout: 15000 },
    )
    .then(() => true)
    .catch(() => false);
  if (!adaPenjelasan) tanpaPesan.push(rute);
}
ok('Data gagal dimuat: tiap halaman menjelaskan keadaannya', tanpaPesan.length === 0,
   tanpaPesan.join(', ') || `${HALAMAN.length} halaman diperiksa`);
await pSebagian.close();

// ---------- Mode kiosk ----------
const pKiosk = await halamanBaru(browser);
await masuk(pKiosk);
await pKiosk.goto(`${BASE}/scan`, { waitUntil: 'networkidle2' });
await pKiosk.waitForFunction(() => document.body.innerText.includes('Mode kiosk'), { timeout: 40000 });
await klik(pKiosk, 'Mode kiosk');
await tunggu(1400);

/*
 * Yang diperiksa bukan ukuran kotaknya, melainkan siapa yang benar-benar ada di
 * atas titik tertentu: sebuah panel boleh saja selebar layar tapi tetap berada
 * di BAWAH sidebar. elementFromPoint menjawab pertanyaan yang sesungguhnya —
 * kalau petugas menyentuh bekas posisi sidebar, yang kena kiosk atau menu?
 */
const kiosk = await pKiosk.evaluate(() => {
  const el = document.querySelector('[data-uji="kiosk-aktif"]');
  if (!el) return null;
  const sidebar = document.querySelector('aside');
  const topbar = document.querySelector('header');
  const diAtas = (x, y) => el.contains(document.elementFromPoint(x, y));
  /*
   * Titik ujinya diambil dari kotak sidebar dan topbar yang sesungguhnya,
   * BUKAN dari pojok layar: window.innerWidth termasuk batang gulir selebar
   * 15px, dan elementFromPoint di atas batang gulir mengembalikan null —
   * kegagalan palsu yang tidak ada hubungannya dengan kiosk.
   */
  const s = sidebar?.getBoundingClientRect();
  const t = topbar?.getBoundingClientRect();
  return {
    posisi: getComputedStyle(el).position,
    diAtasSidebar: Boolean(s) && diAtas(s.left + s.width / 2, s.top + 60),
    // Ujung kanan topbar = tombol tema dan menu akun.
    diAtasTopbar: Boolean(t) && diAtas(t.right - 12, t.top + t.height / 2),
    diPojokKiriAtas: diAtas(8, 8),
  };
});
ok('Mode kiosk menutupi seluruh layar termasuk sidebar dan topbar',
   kiosk?.posisi === 'fixed' && kiosk.diAtasSidebar && kiosk.diAtasTopbar && kiosk.diPojokKiriAtas,
   JSON.stringify(kiosk));
ok('Status penjagaan layar dinyatakan',
   /Layar dijaga menyala|Layar tidak dijaga/.test(await teks(pKiosk)));
await tangkapLayar(pKiosk, '08-kiosk');

// Esc wajib keluar — kalau tidak, petugas terjebak di layar yang seolah tidak bisa ditutup.
await pKiosk.keyboard.press('Escape');
await tunggu(1000);
ok('Esc keluar dari mode kiosk', (await pKiosk.$('[data-uji="kiosk-aktif"]')) === null);
ok('Kiosk: tidak ada error JavaScript', pKiosk.galatJs.length === 0,
   pKiosk.galatJs.slice(0, 2).join(' | ') || 'bersih');

const r = ringkas();
await browser.close();
process.exit(r.gagal ? 1 : 0);
