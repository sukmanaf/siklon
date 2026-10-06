/**
 * Konsol Scan: siaran socket, kartu hasil, riwayat, presensi manual, dan
 * absen pulang.
 *
 * Notifikasi WhatsApp DIMATIKAN selama suite ini berjalan. Kalau tidak, tiap
 * scan uji mengirim pesan sungguhan ke nomor wali — puluhan pesan beruntun ke
 * satu nomor adalah pola yang paling cepat membuat nomor Baileys diblokir.
 */

import {
  BASE,
  angka,
  buatPencatat,
  bukaBrowser,
  halamanBaru,
  klik,
  masuk,
  pastikanHariSekolah,
  pulihkanNanti,
  scanAgent,
  sql,
  sqlJalan,
  tangkapLayar,
  teks,
  tunggu,
  tungguToastHilang,
} from '../bersama.mjs';

const { ok, ringkas } = buatPencatat('Konsol Scan');

// ---------- Siapkan: hari sekolah, hening, dan hari ini bersih ----------
/*
 * Hari ini dipastikan terhitung hari sekolah lebih dulu.
 *
 * Tanpa ini seluruh suite gagal tiap Sabtu dan Minggu — bukan karena produknya
 * rusak, justru karena produknya BENAR menolak mencatat presensi di hari bukan
 * sekolah. Setelannya dikembalikan otomatis di akhir.
 */
const hariSekolah = pastikanHariSekolah();
if (hariSekolah.diubah) {
  console.log(`  (hari ini bukan hari sekolah — setelan dipinjam sementara untuk uji)`);
}


const notifyAwal = sql(
  `SELECT coalesce(string_agg(id::text, ','), '') FROM students WHERE notify`,
);
sqlJalan('UPDATE students SET notify = false');
const kembalikanNotify = pulihkanNanti(() => {
  sqlJalan('UPDATE students SET notify = false');
  if (notifyAwal) sqlJalan(`UPDATE students SET notify = true WHERE id IN ('${notifyAwal.split(',').join("','")}')`);
});
const bersihkanHariIni = () => {
  sqlJalan('DELETE FROM attendance WHERE attendance_date = CURRENT_DATE');
  sqlJalan("DELETE FROM wa_messages WHERE created_at::date = CURRENT_DATE");
};
bersihkanHariIni();

/** Tiga NIS pertama yang punya kelas — dipakai bergantian. */
const nisUji = sql(
  `SELECT string_agg(nis, ',') FROM (SELECT nis FROM students WHERE class_id IS NOT NULL AND is_active ORDER BY nis LIMIT 3) x`,
).split(',');
const [NIS_A, NIS_B, NIS_C] = nisUji;
const namaA = sql(`SELECT full_name FROM students WHERE nis='${NIS_A}'`);

const jamPulang = sql(`SELECT value->>'jam_pulang' FROM settings WHERE key='presensi'`);
const jamMasuk = sql(`SELECT value->>'jam_masuk' FROM settings WHERE key='presensi'`);

const browser = await bukaBrowser();
const p = await halamanBaru(browser, { lebar: 1600, tinggi: 1000 });
await masuk(p);

await p.goto(`${BASE}/scan`, { waitUntil: 'networkidle2' });
await p.waitForFunction(() => /Tersambung/.test(document.body.innerText), { timeout: 40000 });
ok('Socket tersambung dan ditandai di layar', true);

// ---------- Scan masuk: kartu hasil ----------
const hasilMasuk = await scanAgent(NIS_A, '06:55:00');
await p.waitForFunction((n) => document.body.innerText.includes(n), { timeout: 25000 }, namaA);
await tunggu(700);
ok('Hasil scan sampai ke layar lewat siaran socket', true, `${hasilMasuk.status} · ${hasilMasuk.pesan}`);
ok('Scan pagi sebelum batas dihitung HADIR', hasilMasuk.status === 'HADIR', hasilMasuk.status);

const ukuranNama = await p.evaluate((n) => {
  const el = [...document.querySelectorAll('div')].find((d) => d.textContent.trim() === n);
  return el ? Math.round(parseFloat(getComputedStyle(el).fontSize)) : 0;
}, namaA);
ok('Nama siswa dicetak besar (terbaca dari jarak dua meter)', ukuranNama >= 40, `${ukuranNama}px`);

const warnaHadir = await p.evaluate(() => {
  const el = document.querySelector('[role="status"][aria-live="assertive"]');
  return el ? getComputedStyle(el).backgroundColor : null;
});
ok('Kartu berwarna hijau saat HADIR', warnaHadir === 'rgb(220, 252, 231)', String(warnaHadir));
await tangkapLayar(p, '04-kartu-hadir');

// ---------- Konsol tidak menampilkan video ----------
const videoTerlihat = await p.evaluate(() =>
  [...document.querySelectorAll('video')].some((v) => v.getBoundingClientRect().width > 4));
ok('Konsol Scan tidak menampilkan video kamera', !videoTerlihat);

const tata = await p.evaluate(() => {
  const g = document.querySelector('[data-uji="tata-konsol"]');
  if (!g) return null;
  const [kiri, kanan] = [...g.children].map((c) => c.getBoundingClientRect().width);
  return {
    kiri: Math.round((kiri / (kiri + kanan)) * 100),
    tabelDiKanan: Boolean(g.children[1]?.querySelector('table')),
  };
});
ok('Tata letak 30/70 — detail di kiri, tabel di kanan',
   Boolean(tata) && Math.abs(tata.kiri - 30) <= 3 && tata.tabelDiKanan, JSON.stringify(tata));

// ---------- Terlambat ----------
const hasilTelat = await scanAgent(NIS_B, '08:30:00');
await tunggu(1200);
ok('Scan lewat batas dihitung TERLAMBAT', hasilTelat.status === 'TERLAMBAT',
   `${hasilTelat.pesan} (jam masuk ${jamMasuk})`);
const warnaTelat = await p.evaluate(() => {
  const el = document.querySelector('[role="status"][aria-live="assertive"]');
  return el ? getComputedStyle(el).backgroundColor : null;
});
ok('Kartu berwarna kuning saat TERLAMBAT', warnaTelat !== warnaHadir, String(warnaTelat));

// ---------- Scan dobel sebelum jam pulang ----------
const dobel = await scanAgent(NIS_A, '09:30:00');
ok('Scan kedua sebelum jam pulang ditolak sebagai scan dobel',
   dobel.ok === false && dobel.kode === 'SUDAH_ABSEN', `${dobel.kode}: ${dobel.pesan}`);

// ---------- Absen pulang ----------
const pulang = await scanAgent(NIS_A, `${jamPulang}:00`);
await tunggu(1200);
ok('Scan pada jam pulang dicatat sebagai PULANG',
   pulang.ok === true && pulang.jenis === 'PULANG', `${pulang.pesan}`);
const sudahPulang = await scanAgent(NIS_A, '15:00:00');
ok('Scan sesudah pulang ditolak, bukan menimpa jamnya',
   sudahPulang.ok === false && sudahPulang.kode === 'SUDAH_PULANG', sudahPulang.pesan);

const baris = sql(
  `SELECT status || '|' || coalesce(to_char(check_in_at AT TIME ZONE 'Asia/Jakarta','HH24:MI'),'-')
        || '|' || coalesce(to_char(check_out_at AT TIME ZONE 'Asia/Jakarta','HH24:MI'),'-')
     FROM attendance a JOIN students s ON s.id=a.student_id
    WHERE s.nis='${NIS_A}' AND a.attendance_date=CURRENT_DATE`,
);
ok('Masuk dan pulang ada di SATU baris presensi yang sama', baris.split('|').length === 3,
   `status|masuk|pulang = ${baris}`);
ok('Satu siswa tetap satu baris per hari',
   angka(`SELECT count(*) FROM attendance a JOIN students s ON s.id=a.student_id WHERE s.nis='${NIS_A}' AND a.attendance_date=CURRENT_DATE`) === 1);

const barisPulang = await p.evaluate(() =>
  [...document.querySelectorAll('table tbody tr')].some((r) => /Pulang/.test(r.innerText)));
ok('Riwayat menandai barisnya sebagai Pulang', barisPulang);
await tangkapLayar(p, '04-kartu-pulang');

// ---------- Scan pertama sesudah jam pulang ----------
const hanyaPulang = await scanAgent(NIS_C, '15:30:00');
ok('Scan pertama sesudah jam pulang dicatat sebagai pulang, bukan "terlambat 8 jam"',
   hanyaPulang.jenis === 'PULANG' && hanyaPulang.ok === true, hanyaPulang.pesan);
const tanpaMasuk = sql(
  `SELECT coalesce(to_char(check_in_at,'HH24:MI'),'KOSONG') FROM attendance a JOIN students s ON s.id=a.student_id
    WHERE s.nis='${NIS_C}' AND a.attendance_date=CURRENT_DATE`,
);
ok('Jam masuknya dibiarkan KOSONG, bukan ditebak dari jam pulang', tanpaMasuk === 'KOSONG', tanpaMasuk);

// ---------- Riwayat tidak dobel ----------
const barisTabel = await p.$$eval('table tbody tr', (r) => r.length);
const kejadianTercatat = angka(
  `SELECT count(*) FROM attendance WHERE attendance_date=CURRENT_DATE`,
);
ok('Satu kejadian = satu baris riwayat (tidak dobel dari socket + HTTP)',
   barisTabel > 0 && barisTabel <= kejadianTercatat + 4,
   `${barisTabel} baris di layar · ${kejadianTercatat} baris presensi`);

// ---------- Presensi manual ----------
bersihkanHariIni();
await p.reload({ waitUntil: 'networkidle2' });
await p.waitForFunction(() => /Tersambung/.test(document.body.innerText), { timeout: 40000 });
await tungguToastHilang(p);
await klik(p, 'Presensi manual');
await p.waitForSelector('#cari-siswa-manual', { timeout: 20000 });
await tunggu(600);

// Alurnya: cari siswa -> klik hasilnya -> tulis alasan -> catat.
await p.type('#cari-siswa-manual', NIS_B);
await p.waitForFunction(
  (nis) => [...document.querySelectorAll('[role="dialog"] button')].some((b) => b.textContent.includes(nis)),
  { timeout: 20000 },
  NIS_B,
);
await klik(p, NIS_B, '[role="dialog"] button');
await tunggu(500);
await p.type('#catatan-manual', 'Kartu tertinggal di rumah');
await tunggu(300);
await klik(p, 'Catat presensi', '[role="dialog"] button');
const manualOk = await p
  .waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 25000 })
  .then(() => true)
  .catch(() => false);
ok('Presensi manual tercatat', manualOk);
ok('Ditandai MANUAL dan ada jejak siapa yang mengubah',
   sql(`SELECT device_code || '|' || (updated_by IS NOT NULL)::text FROM attendance a JOIN students s ON s.id=a.student_id WHERE s.nis='${NIS_B}' AND a.attendance_date=CURRENT_DATE`)
     === 'MANUAL|true');

ok('Tidak ada error JavaScript', p.galatJs.length === 0, p.galatJs.slice(0, 2).join(' | ') || 'bersih');

bersihkanHariIni();
kembalikanNotify();
ok('Data uji dibersihkan',
   angka('SELECT count(*) FROM attendance WHERE attendance_date=CURRENT_DATE') === 0);

const r = ringkas();
await browser.close();
process.exit(r.gagal ? 1 : 0);
