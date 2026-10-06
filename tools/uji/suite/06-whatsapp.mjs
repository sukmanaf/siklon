/**
 * Halaman WhatsApp: koneksi, template, log pengiriman, dan pengaturan kirim.
 *
 * TIDAK ADA satu pun pesan sungguhan yang dikirim di sini. Baris log disiapkan
 * langsung di database, dan template dikembalikan ke bentuk semula di akhir.
 * Menguji tampilan tidak boleh sampai membanjiri nomor wali murid.
 */

import {
  API,
  BASE,
  angka,
  buatPencatat,
  bukaBrowser,
  halamanBaru,
  klik,
  masuk,
  sql,
  sqlJalan,
  tangkapLayar,
  teks,
  tunggu,
  tungguToastHilang,
} from '../bersama.mjs';

const { ok, lewati, ringkas } = buatPencatat('WhatsApp');

const templateAwal = sql(`SELECT value::text FROM settings WHERE key='template_wa'`);
const kirimSaatAwal = sql(`SELECT value->>'kirim_saat' FROM settings WHERE key='whatsapp'`);
const TANDA = `uji-${Date.now()}`;

sqlJalan("DELETE FROM wa_messages WHERE body LIKE '%baris uji%'");

const browser = await bukaBrowser();
const p = await halamanBaru(browser, { lebar: 1600, tinggi: 1000 });
await masuk(p);

// ---------- Tab Koneksi ----------
await p.goto(`${BASE}/whatsapp`, { waitUntil: 'networkidle2' });
await p.waitForFunction(() => /Status Koneksi/.test(document.body.innerText), { timeout: 60000 });
const isiKoneksi = await teks(p);
ok('Status koneksi tampil', /Tersambung|Terputus/.test(isiKoneksi));
ok('Keadaan pengaman pengiriman dinyatakan di layar',
   /WA_PROVIDER|WA_ALLOWLIST|pagar penerima|dummy|nomor di/i.test(isiKoneksi),
   isiKoneksi.split('\n').find((l) => /ALLOWLIST|dummy|pagar/i.test(l))?.slice(0, 80) ?? '');
ok('Antrean menampilkan jumlah yang menunggu', /MENUNGGU/i.test(isiKoneksi));
ok('Tombol ganti nomor tersedia (nomor Baileys itu barang habis pakai)',
   /Ganti nomor/i.test(isiKoneksi));
await tangkapLayar(p, '06-koneksi');

// ---------- Tab Template ----------
await p.goto(`${BASE}/whatsapp?tab=template`, { waitUntil: 'networkidle2' });
await p.waitForSelector('textarea[aria-label^="Template"]', { timeout: 40000 });
await tunggu(700);

await p.click('textarea[aria-label^="Template"]');
await p.keyboard.down('Control'); await p.keyboard.press('KeyA'); await p.keyboard.up('Control');
await p.type('textarea[aria-label^="Template"]', 'Bpk/Ibu, ananda *{siswa}* ({kelas}) terlambat {menit} menit.');
await tunggu(900);
const pratinjau = await p.$eval('[data-uji="pratinjau-wa"]', (e) => e.innerText);
ok('Pratinjau mengganti variabel dengan contoh nyata',
   /Andi Pratama/.test(pratinjau) && !/\{siswa\}/.test(pratinjau),
   pratinjau.split('\n')[0]?.slice(0, 70) ?? '');
const tebal = await p.$$eval('[data-uji="pratinjau-wa"] b', (b) => b.length);
ok('Format *tebal* WhatsApp ikut dirender', tebal >= 1, `${tebal} bagian tebal`);

await p.type('textarea[aria-label^="Template"]', ' {nama_wali}');
await tunggu(700);
ok('Variabel salah tulis diperingatkan, bukan diam-diam lolos',
   /Variabel tidak dikenal/i.test(await teks(p)));

// Chip menyisipkan variabel di posisi kursor.
await p.click('textarea[aria-label^="Template"]');
await p.keyboard.down('Control'); await p.keyboard.press('KeyA'); await p.keyboard.up('Control');
await p.type('textarea[aria-label^="Template"]', 'Ananda ');
await klik(p, '{siswa}');
await tunggu(500);
const isiArea = await p.$eval('textarea[aria-label^="Template"]', (e) => e.value);
ok('Klik chip menyisipkan variabel di posisi kursor', isiArea === 'Ananda {siswa}', isiArea);

/*
 * Tombol Simpan MATI kalau teksnya tidak berubah, jadi nilai yang ditulis harus
 * pasti berbeda tiap jalan — kalau tidak, uji ini gagal di jalan kedua karena
 * sebab yang salah.
 */
await p.click('textarea[aria-label^="Template"]');
await p.keyboard.down('Control'); await p.keyboard.press('KeyA'); await p.keyboard.up('Control');
await p.type('textarea[aria-label^="Template"]', `Ananda *{siswa}* ({kelas}) terlambat {menit} menit. [${TANDA}]`);
await tungguToastHilang(p);
await klik(p, 'Simpan');
const tersimpan = await p
  .waitForFunction(() => /disimpan/i.test(document.body.innerText), { timeout: 25000 })
  .then(() => true)
  .catch(() => false);
ok('Template tersimpan ke server', tersimpan);

/*
 * Databasenya DIULANG BACA, bukan dibaca sekali tepat setelah toast muncul.
 *
 * Toast "disimpan" adalah reaksi layar terhadap jawaban HTTP; membaca database
 * pada detik yang sama kadang mendahului commit-nya — terutama saat seluruh
 * rangkaian berjalan dan mesinnya sedang sibuk. Sekali gagal, uji ini akan
 * terlihat seperti cacat "template tidak tersimpan" padahal sedetik kemudian
 * nilainya ada. Ini bukan menutupi cacat: batasnya pendek (2 detik), dan
 * template yang benar-benar tidak tersimpan tetap gagal.
 */
let tersimpanDiDb = false;
for (let coba = 0; coba < 20 && !tersimpanDiDb; coba++) {
  tersimpanDiDb = sql(`SELECT value::text FROM settings WHERE key='template_wa'`).includes(TANDA);
  if (!tersimpanDiDb) await tunggu(100);
}
ok('Benar-benar tersimpan, bukan hanya di layar', tersimpanDiDb);
await tangkapLayar(p, '06-template');

// ---------- Tab Log ----------
// Baris log disiapkan lewat SQL, BUKAN dengan memicu scan: menguji tampilan log
// tidak boleh sampai mengirim WhatsApp ke orang.
sqlJalan(`
  INSERT INTO wa_messages (student_id, phone, body, event, status, sent_at)
  SELECT id, coalesce(guardian_phone, '628000000000'),
         'Ananda ' || full_name || ' telah HADIR di sekolah. (baris uji, tidak pernah dikirim)',
         'MASUK', 'SENT', now()
    FROM students ORDER BY nis LIMIT 2`);

await p.goto(`${BASE}/whatsapp?tab=log`, { waitUntil: 'networkidle2' });
await p.waitForSelector('table tbody tr', { timeout: 40000 });
await tunggu(700);
const barisLog = await p.$$eval('table tbody tr', (r) => r.length);
ok('Log pengiriman menampilkan pesan di antrean', barisLog >= 2, `${barisLog} baris`);
ok('Nomor penerima disamarkan di daftar', /\*{2,}/.test(await teks(p)));

await klik(p, 'Lihat', 'table tbody tr button');
await p.waitForSelector('[role="dialog"]', { timeout: 20000 });
await tunggu(800);
const gelembung = await p.$eval('[role="dialog"] [data-uji="isi-gelembung"]', (e) => e.innerText);
ok('Isi pesan lengkap bisa dilihat saat dibuka', /Ananda/.test(gelembung), gelembung.slice(0, 60));
const nomorPenuh = await p.$eval('[role="dialog"]', (e) => /(\d{10,})/.exec(e.innerText)?.[1] ?? '');
ok('Nomor penuh hanya muncul saat pesannya dibuka', nomorPenuh.length >= 10, nomorPenuh || 'tidak ada');
await p.keyboard.press('Escape');
await tunggu(600);

// ---------- Tab Pengaturan Kirim ----------
await p.goto(`${BASE}/whatsapp?tab=kirim`, { waitUntil: 'networkidle2' });
// Angka volumenya dibaca dari penanda khusus, bukan dari teks bebas: teks di
// layar berubah bentuk mengikuti kuota, penandanya tidak.
await p.waitForSelector('[data-uji="pesan-per-hari"]', { timeout: 40000 });
await tunggu(900);
const bacaPerHari = () =>
  p.$eval('[data-uji="pesan-per-hari"]', (e) => Number(e.innerText.replace(/\D/g, '')));
const sebelum = await bacaPerHari();
ok('Perkiraan pesan per hari dihitung', Number.isFinite(sebelum), `${sebelum} pesan/hari`);
ok('Ekor antrean ikut ditampilkan', (await p.$('[data-uji="ekor-antrean"]')) !== null);

const adaPulang = /PULANG|Siswa pulang/i.test(await teks(p));
ok('Kejadian PULANG ikut ditawarkan di pengaturan kirim', adaPulang);

/*
 * Mematikan satu kejadian harus menurunkan perkiraannya seketika. Ini yang
 * dulu bocor: kejadian PULANG ditambahkan tapi tidak ikut dihitung, sehingga
 * volume yang ditampilkan lebih kecil dari kenyataan.
 *
 * Perkiraannya dihitung dari jumlah PENERIMA. Kalau tidak ada satu pun siswa
 * dengan notify menyala, angkanya nol apa pun yang dicentang — dan menguji
 * reaksinya jadi tidak berarti. Itu keadaan lingkungan, bukan kegagalan.
 */
const penerima = angka('SELECT count(*) FROM students WHERE notify AND guardian_phone IS NOT NULL');
if (penerima === 0) {
  lewati('Perkiraan volume bereaksi saat kejadian dimatikan',
         'tidak ada siswa dengan notify menyala, jadi perkiraannya selalu 0');
} else {
  await klik(p, 'Siswa hadir', 'label, button');
  await tunggu(1200);
  const sesudah = await bacaPerHari();
  ok('Mematikan satu kejadian langsung menurunkan perkiraan', sesudah < sebelum,
     `${sebelum} -> ${sesudah} pesan/hari`);
  await klik(p, 'Siswa hadir', 'label, button');
  await tunggu(1200);
  ok('Menyalakannya lagi mengembalikan angkanya', (await bacaPerHari()) === sebelum,
     `${sesudah} -> ${await bacaPerHari()}`);
}
await tangkapLayar(p, '06-pengaturan-kirim');

ok('Tidak ada error JavaScript', p.galatJs.length === 0, p.galatJs.slice(0, 2).join(' | ') || 'bersih');

// ---------- Kembalikan ----------
sqlJalan(`UPDATE settings SET value = '${templateAwal.replace(/'/g, "''")}'::jsonb WHERE key='template_wa'`);
sqlJalan(`UPDATE settings SET value = jsonb_set(value, '{kirim_saat}', '${kirimSaatAwal}'::jsonb) WHERE key='whatsapp'`);
sqlJalan("DELETE FROM wa_messages WHERE body LIKE '%baris uji%'");
// Cache setelan di server hanya dibuang lewat jalur aplikasi, jadi database yang
// dikembalikan lewat SQL perlu disusul permintaan simpan agar server ikut tahu.
await p.evaluate(async (api, tpl) => {
  await fetch(`${api}/settings/template_wa`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: tpl,
  });
}, API, templateAwal);
ok('Template dikembalikan seperti semula',
   !sql(`SELECT value::text FROM settings WHERE key='template_wa'`).includes(TANDA));

const r = ringkas();
await browser.close();
process.exit(r.gagal ? 1 : 0);
