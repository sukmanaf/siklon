/**
 * Kelas, kenaikan kelas, dan pergantian tahun ajaran.
 *
 * Bagian paling penting di sini bukan tombolnya, tapi satu jaminan struktural:
 * sesudah siswa naik ke kelas tahun berikutnya, **riwayat presensi lama harus
 * tetap menunjuk kelas tahun lalu**. Itu bekerja karena tabel `attendance`
 * menyimpan `class_id`-nya sendiri saat presensi dicatat. Kalau jaminan itu
 * pecah, seluruh laporan bulan-bulan lalu ikut berubah tanpa ada yang sadar.
 *
 * Suite ini memindahkan siswa sungguhan, jadi keadaannya dikembalikan di akhir.
 */

import {
  BASE,
  angka,
  buatPencatat,
  bukaBrowser,
  halamanBaru,
  klik,
  masuk,
  pilih,
  sql,
  sqlJalan,
  tangkapLayar,
  teks,
  tunggu,
  tungguToastHilang,
} from '../bersama.mjs';

const { ok, lewati, ringkas } = buatPencatat('Kelas');

const tahunAktif = sql('SELECT name FROM academic_years WHERE is_active');
const idTahunAktif = angka('SELECT id FROM academic_years WHERE is_active');
const tahunLain = sql(
  `SELECT name FROM academic_years WHERE NOT is_active ORDER BY id LIMIT 1`,
);
const idTahunLain = tahunLain ? angka(`SELECT id FROM academic_years WHERE name='${tahunLain}'`) : 0;

/** Kelas asal tiap siswa, untuk dikembalikan di akhir. */
const kelasAwal = sql(
  `SELECT coalesce(string_agg(s.id || '=' || s.class_id, ','), '') FROM students s WHERE s.class_id IS NOT NULL`,
);
function kembalikanKelas() {
  if (!kelasAwal) return;
  for (const pasang of kelasAwal.split(',')) {
    const [siswa, kelas] = pasang.split('=');
    sqlJalan(`UPDATE students SET class_id='${kelas}' WHERE id='${siswa}'`);
  }
}

const browser = await bukaBrowser();
const p = await halamanBaru(browser);
await masuk(p);

// ---------- Daftar kelas ----------
await p.goto(`${BASE}/kelas`, { waitUntil: 'networkidle2' });
await p.waitForSelector('table tbody tr', { timeout: 60000 });
const jumlahKelas = angka(`SELECT count(*) FROM classes WHERE academic_year_id=${idTahunAktif}`);
const barisKelas = await p.$$eval('table tbody tr', (r) => r.length);
ok('Daftar kelas menampilkan kelas tahun ajaran aktif', barisKelas === jumlahKelas,
   `${barisKelas} baris · ${jumlahKelas} kelas di ${tahunAktif}`);
ok('Tahun ajaran aktif disebut di layar', (await teks(p)).includes(tahunAktif), tahunAktif);
ok('Kolom "Wali Kelas" sudah tidak ada', !/Wali Kelas/i.test(await teks(p)));

if (!tahunLain) {
  lewati('Pergantian tahun ajaran', 'hanya ada satu tahun ajaran di database');
} else {
  // Mulai bersih: tahun tujuan belum punya kelas.
  sqlJalan(`DELETE FROM classes WHERE academic_year_id=${idTahunLain}`);

  // ---------- Salin kerangka kelas ----------
  await p.reload({ waitUntil: 'networkidle2' });
  await p.waitForSelector('table tbody tr', { timeout: 60000 });
  await tungguToastHilang(p);
  await klik(p, 'Salin ke Tahun Lain');
  await p.waitForSelector('[role="dialog"]', { timeout: 20000 });
  await tunggu(700);
  const isiSalin = await p.$eval('[role="dialog"]', (e) => e.innerText);
  ok('Dialog salin menyebut berapa kelas dan dari tahun mana',
     isiSalin.includes(String(jumlahKelas)) && isiSalin.includes(tahunAktif),
     isiSalin.split('\n').find((l) => /Yang disalin/.test(l)) ?? '');
  await tangkapLayar(p, '03-salin-kelas');

  await pilih(p, '#ke-tahun', tahunLain);
  await klik(p, 'Salin kelas', '[role="dialog"] button');
  await p.waitForFunction(() => /disalin/i.test(document.body.innerText), { timeout: 25000 });
  await tunggu(900);
  ok('Kerangka kelas tersalin ke tahun tujuan',
     angka(`SELECT count(*) FROM classes WHERE academic_year_id=${idTahunLain}`) === jumlahKelas,
     `${angka(`SELECT count(*) FROM classes WHERE academic_year_id=${idTahunLain}`)} kelas`);
  ok('Siswanya TIDAK ikut tersalin',
     angka(`SELECT count(*) FROM students s JOIN classes c ON c.id=s.class_id WHERE c.academic_year_id=${idTahunLain}`) === 0);

  // ---------- Kenaikan kelas lintas tahun ----------
  await p.goto(`${BASE}/kelas`, { waitUntil: 'networkidle2' });
  await p.waitForSelector('table tbody tr', { timeout: 60000 });
  await tungguToastHilang(p);
  await klik(p, 'Kenaikan Kelas');
  await p.waitForSelector('[role="dialog"]', { timeout: 20000 });
  await tunggu(900);
  ok('Dialog kenaikan punya pemilih tahun ajaran tujuan', (await p.$('#tahun-tujuan')) !== null);

  await pilih(p, '#tahun-tujuan', tahunLain);
  await tunggu(1600);
  const setelahPilih = await p.$eval('[role="dialog"]', (e) => e.innerText);
  ok('Memilih tahun lain memperingatkan bahwa kelas tahun berjalan akan terlihat kosong',
     /kosong/i.test(setelahPilih),
     setelahPilih.split('\n').find((l) => /kosong/i.test(l))?.slice(0, 80) ?? '');
  await tangkapLayar(p, '03-kenaikan-kelas');

  const siswaSebelum = angka(
    `SELECT count(*) FROM students s JOIN classes c ON c.id=s.class_id WHERE c.academic_year_id=${idTahunAktif} AND s.is_active`,
  );
  await klik(p, 'Lihat pratinjau', '[role="dialog"] button');
  await tunggu(800);
  const pratinjau = await p.$eval('[role="dialog"]', (e) => e.innerText);
  ok('Pratinjau menyebut tahun ajaran tujuannya', pratinjau.includes(tahunLain),
     pratinjau.split('\n').find((l) => /dipindahkan/.test(l))?.slice(0, 95) ?? '');

  await klik(p, 'Jalankan kenaikan kelas', '[role="dialog"] button');
  await p.waitForFunction(() => /naik kelas/i.test(document.body.innerText), { timeout: 30000 });
  await tunggu(1200);
  const pindah = angka(
    `SELECT count(*) FROM students s JOIN classes c ON c.id=s.class_id WHERE c.academic_year_id=${idTahunLain}`,
  );
  ok('Siswa benar-benar pindah ke kelas tahun berikutnya', pindah === siswaSebelum,
     `${pindah} dari ${siswaSebelum} siswa`);
  const tingkatNaik = sql(
    `SELECT DISTINCT c.grade_level::text FROM students s JOIN classes c ON c.id=s.class_id WHERE c.academic_year_id=${idTahunLain}`,
  );
  ok('Tingkatnya naik satu', tingkatNaik !== '', `tingkat tujuan: ${tingkatNaik}`);

  // Inti jaminannya.
  const riwayatLama = angka(
    `SELECT count(*) FROM attendance a JOIN classes c ON c.id=a.class_id WHERE c.academic_year_id=${idTahunAktif}`,
  );
  ok('Riwayat presensi lama TETAP menunjuk kelas tahun lalu', riwayatLama > 0,
     `${riwayatLama} baris presensi tidak ikut berpindah`);

  // ---------- Kembalikan ----------
  kembalikanKelas();
  sqlJalan(`DELETE FROM classes WHERE academic_year_id=${idTahunLain}`);
  ok('Keadaan dikembalikan seperti semula',
     angka(`SELECT count(*) FROM students s JOIN classes c ON c.id=s.class_id WHERE c.academic_year_id=${idTahunAktif}`) === siswaSebelum);
}

ok('Tidak ada error JavaScript', p.galatJs.length === 0, p.galatJs.slice(0, 2).join(' | ') || 'bersih');

const r = ringkas();
await browser.close();
process.exit(r.gagal ? 1 : 0);
