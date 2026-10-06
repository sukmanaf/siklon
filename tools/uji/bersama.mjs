/**
 * Pustaka bersama untuk seluruh suite uji.
 *
 * Uji di sini menjalankan browser sungguhan melawan server yang benar-benar
 * hidup — bukan tiruan. Itu disengaja: bug yang paling sering lolos di proyek
 * ini adalah yang hanya muncul saat browser, server, dan database bertemu
 * (kamera, socket, cetak, cache setelan).
 *
 * Dua aturan yang lahir dari kesalahan nyata dan dipegang di semua suite:
 *
 *  1. **Uji menyiapkan datanya sendiri, dan mengembalikannya.** Pernah terjadi
 *     suite mengandalkan sisa suite lain, lalu gagal begitu sisa itu
 *     dibersihkan — gagal karena sebab yang salah, dan memakan waktu lama
 *     untuk disadari.
 *  2. **Asersi tidak mematok angka data.** `barisHarian === 3` benar saat kelas
 *     berisi 3 siswa dan salah begitu berisi 32. Hitung dari datanya.
 */

import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

export const DIR_UJI = dirname(fileURLToPath(import.meta.url));
export const DIR_HASIL = join(DIR_UJI, 'hasil');

export const BASE = process.env.SIKLON_WEB ?? 'http://localhost:3000';
export const API = process.env.SIKLON_API ?? 'http://localhost:4000/api/v1';
export const KUNCI_SCANNER = process.env.SCANNER_API_KEY ?? 'dev-scanner-key-1234567890';
const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome-stable';

const AKUN = { username: 'superadmin', password: 'siklon123' };

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

/*
 * Baris baru diratakan jadi spasi sebelum dikirim ke psql.
 *
 * `-c` menerima satu perintah, dan JSON.stringify mengubah baris baru jadi
 * "\n" harfiah yang membuat psql tersedak. Meratakannya membuat query
 * multi-baris bisa ditulis wajar di suite — SQL sendiri tidak peduli barisnya.
 */
const ratakan = (perintah) => perintah.replace(/\s+/g, ' ').trim();

/** Jalankan SQL, kembalikan keluaran mentah (satu nilai untuk query satu kolom). */
export function sql(perintah) {
  return execSync(
    `PGPASSWORD=123123 psql -h localhost -U postgres -d absen -t -A -c ${JSON.stringify(ratakan(perintah))}`,
    { encoding: 'utf8' },
  ).trim();
}

/** Jalankan SQL tanpa peduli keluarannya (INSERT/UPDATE/DELETE). */
export function sqlJalan(perintah) {
  execSync(
    `PGPASSWORD=123123 psql -h localhost -U postgres -d absen -q -c ${JSON.stringify(ratakan(perintah))}`,
    { stdio: 'ignore' },
  );
}

/** Angka tunggal dari query, mis. `angka('SELECT count(*) FROM students')`. */
export const angka = (perintah) => Number(sql(perintah));

/**
 * Daftarkan pemulihan keadaan yang BERTAHAN walau suite-nya gagal di tengah.
 *
 * Ini lahir dari kejadian nyata: satu suite mematikan `notify` semua siswa,
 * lalu melempar sebelum sempat mengembalikannya. Suite berikutnya menyimpan
 * keadaan "sudah rusak" itu sebagai nilai asli, dan kerusakannya menetap
 * berjam-jam tanpa ada yang sadar. Membersihkan di baris terakhir skrip tidak
 * cukup — barisnya tidak pernah tercapai kalau ada yang melempar.
 */
export function pulihkanNanti(fn) {
  let sudah = false;
  const sekali = () => {
    if (sudah) return;
    sudah = true;
    try {
      fn();
    } catch (e) {
      console.error('Pemulihan keadaan gagal:', e?.message ?? e);
    }
  };
  process.on('exit', sekali);
  process.on('uncaughtException', (e) => {
    sekali();
    console.error(e);
    process.exit(1);
  });
  process.on('unhandledRejection', (e) => {
    sekali();
    console.error(e);
    process.exit(1);
  });
  return sekali;
}

// ---------------------------------------------------------------------------
// Pencatat hasil
// ---------------------------------------------------------------------------

export function buatPencatat(namaSuite) {
  const baris = [];
  return {
    ok(nama, lulus, keterangan = '') {
      baris.push({ nama, lulus, keterangan });
      console.log(`${lulus ? '✓' : '✗'} ${nama}${keterangan ? `  — ${keterangan}` : ''}`);
      return lulus;
    },
    /** Dipakai saat syarat lingkungan tidak terpenuhi — BUKAN kegagalan. */
    lewati(nama, alasan) {
      baris.push({ nama, lewati: true, keterangan: alasan });
      console.log(`- DILEWATI ${nama}  — ${alasan}`);
    },
    ringkas() {
      const dinilai = baris.filter((b) => !b.lewati);
      const lulus = dinilai.filter((b) => b.lulus).length;
      const dilewati = baris.length - dinilai.length;
      console.log(
        `\nRINGKASAN ${namaSuite}: ${lulus}/${dinilai.length} lulus` +
          (dilewati ? ` · ${dilewati} dilewati` : ''),
      );
      const gagal = dinilai.filter((b) => !b.lulus);
      if (gagal.length) {
        console.log('GAGAL:\n' + gagal.map((g) => ` - ${g.nama} (${g.keterangan})`).join('\n'));
      }
      return { total: dinilai.length, lulus, dilewati, gagal: gagal.length };
    },
  };
}

// ---------------------------------------------------------------------------
// Browser
// ---------------------------------------------------------------------------

/**
 * @param {object} opsi
 * @param {string} [opsi.umpanVideo] berkas .y4m sebagai kamera palsu
 * @param {boolean} [opsi.kameraAsli] pakai kamera sungguhan (untuk /dev/video*)
 */
export async function bukaBrowser(opsi = {}) {
  const args = ['--no-sandbox', '--disable-dev-shm-usage', '--use-fake-ui-for-media-stream'];
  if (!opsi.kameraAsli) args.push('--use-fake-device-for-media-stream');
  if (opsi.umpanVideo) args.push(`--use-file-for-fake-video-capture=${opsi.umpanVideo}`);
  args.push('--autoplay-policy=no-user-gesture-required');
  return puppeteer.launch({ executablePath: CHROME, headless: 'new', args });
}

export async function halamanBaru(browser, { lebar = 1440, tinggi = 950, tema = 'light' } = {}) {
  const p = await browser.newPage();
  await p.setViewport({ width: lebar, height: tinggi });
  await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: tema }]);
  const galat = [];
  p.on('pageerror', (e) => galat.push(e.message));
  p.galatJs = galat;
  return p;
}

/**
 * Masuk sebagai super admin.
 *
 * Cookie sesi dipakai bersama antar tab di profil yang sama, jadi halaman kedua
 * dan seterusnya langsung dialihkan tanpa formulir. Batas waktunya longgar
 * karena dev server mengompilasi rute saat pertama diminta.
 */
export async function masuk(p) {
  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  if (new URL(p.url()).pathname !== '/login') {
    await p.waitForFunction(() => location.pathname === '/dashboard', { timeout: 60000 });
    return;
  }
  await p.waitForSelector('input[autocomplete="username"]', { timeout: 90000 });
  await p.type('input[autocomplete="username"]', AKUN.username);
  await p.type('input[autocomplete="current-password"]', AKUN.password);
  await p.evaluate(
    () => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Masuk').click(),
  );
  await p.waitForFunction(() => location.pathname === '/dashboard', { timeout: 60000 });
}

export const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

export const teks = (p) => p.evaluate(() => document.body.innerText);

/**
 * Klik elemen pertama yang teksnya memuat `cari`.
 *
 * MENUNGGU elemennya muncul, tidak gagal seketika. Halaman ini banyak yang
 * merender ulang sesudah permintaan selesai (gagal login, simpan, ganti tab),
 * dan tombol bisa sesaat tidak ada di DOM. Gagal seketika di situ menghasilkan
 * kegagalan uji yang menyesatkan — tombolnya sebenarnya ada, cuma telat sepersekian detik.
 */
export async function klik(p, cari, selektor = 'button', persis = false, batasMs = 15000) {
  const cocokkan = (t, s, tepat) =>
    [...document.querySelectorAll(s)].find((b) => {
      const isi = b.textContent.trim().toLowerCase();
      return tepat ? isi === t.toLowerCase() : isi.includes(t.toLowerCase());
    }) ?? null;

  await p
    .waitForFunction(cocokkan, { timeout: batasMs }, cari, selektor, persis)
    .catch(() => {
      throw new Error(`Tidak ada "${selektor}" berisi "${cari}" setelah ${batasMs} ms`);
    });

  const h = await p.evaluateHandle(cocokkan, cari, selektor, persis);
  const el = h.asElement();
  if (!el) throw new Error(`Tidak ada "${selektor}" berisi "${cari}"`);
  await el.click();
}

/** Isi input: kosongkan dulu lewat keyboard supaya React ikut tahu. */
export async function isi(p, selektor, nilai) {
  await p.waitForSelector(selektor, { visible: true, timeout: 30000 });
  await p.click(selektor);
  await p.keyboard.down('Control');
  await p.keyboard.press('KeyA');
  await p.keyboard.up('Control');
  await p.keyboard.press('Backspace');
  if (nilai) await p.type(selektor, nilai);
}

/** Pilih nilai di komponen Select Radix (bukan <select> biasa). */
export async function pilih(p, selektorPemicu, labelOpsi) {
  await p.click(selektorPemicu);
  await tunggu(400);
  await klik(p, labelOpsi, '[role="option"]');
  await tunggu(400);
}

/**
 * Toast muncul di pojok kanan atas, tepat menutupi tombol-tombol di kepala
 * kartu. Klik sungguhan akan mendarat di toast, bukan tombolnya.
 */
export async function tungguToastHilang(p) {
  await p
    .waitForFunction(() => !document.querySelector('[data-sonner-toast]'), { timeout: 20000 })
    .catch(() => undefined);
}

export async function tangkapLayar(p, nama) {
  mkdirSync(DIR_HASIL, { recursive: true });
  await p.screenshot({ path: join(DIR_HASIL, `${nama}.png`), fullPage: true });
}

// ---------------------------------------------------------------------------
// API langsung (tanpa browser)
// ---------------------------------------------------------------------------

/** Scan lewat endpoint Scanner Agent — persis jalur yang dipakai alat sungguhan. */
export async function scanAgent(nis, jam, extra = {}) {
  const hariIni = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const res = await fetch(`${API}/scans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': KUNCI_SCANNER },
    body: JSON.stringify({ nis, scannedAt: `${hariIni}T${jam}+07:00`, ...extra }),
  });
  return (await res.json()).data;
}

/** Laporan Scanner Agent; dipakai untuk menyiapkan & membersihkan port uji. */
export async function laporAgent(ports) {
  const res = await fetch(`${API}/agent/hello`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': KUNCI_SCANNER },
    body: JSON.stringify({ agentVersion: '0.0.0-uji', ports }),
  });
  if (!res.ok) throw new Error(`agent/hello gagal: ${res.status}`);
}

export const TANGGAL_HARI_INI = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

// ---------------------------------------------------------------------------
// Hari sekolah
// ---------------------------------------------------------------------------

/**
 * Permintaan HTTP yang SINKRON, lewat curl.
 *
 * Dipakai khusus untuk memulihkan keadaan di `pulihkanNanti()`. Pemulihan itu
 * berjalan di handler `process.on('exit')`, dan di sana event loop sudah mati —
 * `fetch` yang asinkron tidak akan pernah selesai, jadi setelan yang diubah
 * uji akan tertinggal rusak.
 */
function apiSinkron(metode, jalur, badan, kuki) {
  const argumen = ['-s', '-X', metode, `${API}${jalur}`, '-H', 'Content-Type: application/json'];
  if (kuki) argumen.push('-H', `Cookie: ${kuki}`);
  if (badan !== undefined) argumen.push('--data-binary', JSON.stringify(badan));
  argumen.push('-D', '-', '-o', '/dev/null');
  return execSync(`curl ${argumen.map((a) => JSON.stringify(a)).join(' ')}`, { encoding: 'utf8' });
}

/** Sesi admin untuk permintaan dari sisi Node (bukan dari dalam browser). */
export function sesiApiSinkron() {
  const kepala = apiSinkron('POST', '/auth/login', { username: 'superadmin', password: 'siklon123' });
  return [...kepala.matchAll(/^set-cookie:\s*([^;]+)/gim)].map((m) => m[1]).join('; ');
}

/**
 * Pastikan HARI INI dihitung sebagai hari sekolah, lalu kembalikan seperti semula.
 *
 * Tanpa ini seluruh suite yang memindai kartu gagal setiap Sabtu dan Minggu —
 * bukan karena produknya rusak, justru karena produknya BENAR menolak mencatat
 * presensi di hari bukan sekolah. Uji yang hasilnya tergantung hari apa
 * dijalankannya bukan uji; ia cuma kebetulan hijau di hari kerja.
 *
 * Setelan diubah lewat API, bukan SQL langsung: server menyimpan setelan di
 * memori dan cache-nya hanya dibuang lewat jalur simpan aplikasi.
 */
export function pastikanHariSekolah() {
  const dow = Number(sql('SELECT extract(dow from CURRENT_DATE)'));
  const presensiAwal = sql(`SELECT value::text FROM settings WHERE key='presensi'`);
  const presensi = JSON.parse(presensiAwal);
  const liburHariIni = sql(
    `SELECT coalesce(string_agg(name, '|'), '') FROM holidays WHERE holiday_date = CURRENT_DATE`,
  );

  const perluTambahHari = !presensi.hari_sekolah.includes(dow);
  if (!perluTambahHari && !liburHariIni) return { diubah: false, dow };

  const kuki = sesiApiSinkron();
  if (liburHariIni) sqlJalan('DELETE FROM holidays WHERE holiday_date = CURRENT_DATE');
  if (perluTambahHari) {
    apiSinkron('PUT', '/settings/presensi',
      { ...presensi, hari_sekolah: [...presensi.hari_sekolah, dow].sort() }, kuki);
  }

  pulihkanNanti(() => {
    if (perluTambahHari) apiSinkron('PUT', '/settings/presensi', presensi, kuki);
    if (liburHariIni) {
      for (const nama of liburHariIni.split('|')) {
        sqlJalan(
          `INSERT INTO holidays (holiday_date, name) VALUES (CURRENT_DATE, '${nama.replace(/'/g, "''")}')
             ON CONFLICT (holiday_date) DO NOTHING`,
        );
      }
    }
  });

  return { diubah: true, dow, liburDihapus: liburHariIni || null };
}
