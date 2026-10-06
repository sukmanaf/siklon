import ExcelJS from 'exceljs';
import { ambil as ambilSetting } from '../settings/settings.service.js';
import * as lap from './laporan.service.js';

const WARNA: Record<string, string> = {
  HADIR: 'FFDCFCE7',
  TERLAMBAT: 'FFFEF3C7',
  IZIN: 'FFE0F2FE',
  SAKIT: 'FFEDE9FE',
  ALPA: 'FFFEE2E2',
  BELUM: 'FFF1F5F9',
};

/**
 * Blok judul di atas tabel.
 *
 * `rata` ada karena rata tengah menipu pada tabel yang lebih lebar dari satu
 * halaman cetak: teksnya mendarat di tengah SELURUH lebar kolom, yang untuk
 * rekap sebulan berarti di halaman kedua — dan halaman pertama cuma kebagian
 * potongan hurufnya di tepi kanan. Untuk tabel selebar itu, rata kiri yang
 * benar: judulnya selalu terlihat di halaman pertama.
 */
function kepala(
  ws: ExcelJS.Worksheet,
  judul: string[],
  lebarKolom: number,
  rata: 'center' | 'left' = 'center',
) {
  judul.forEach((t, i) => {
    const baris = ws.addRow([t]);
    baris.font = { bold: i === 0, size: i === 0 ? 13 : 10 };
    baris.alignment = { horizontal: rata };
    ws.mergeCells(baris.number, 1, baris.number, lebarKolom);
  });
  ws.addRow([]);
}

/**
 * Menyiapkan berkas supaya LANGSUNG rapi saat dicetak, tanpa perlu diutak-atik
 * di Excel dulu.
 *
 * Tanpa `pageSetup`, Excel memakai bawaan pencetak — di mesin pemilik proyek
 * itu ternyata ukuran amplop, dan rekap sebulan pecah jadi enam halaman
 * dengan judul terpotong.
 *
 * `printTitlesRow` mengulang baris judul tabel di tiap halaman, dan
 * `printTitlesColumn` mengulang kolom No/NIS/Nama — tanpa itu, halaman kedua
 * berisi deretan jam tanpa ada nama siapa pun di sampingnya.
 */
function siapCetak(
  ws: ExcelJS.Worksheet,
  opsi: {
    barisJudulTabel: number;
    halamanLebar: number;
    ulangKolom?: string;
    /** Rekap satu siswa cuma tujuh kolom — tegak memuat lebih banyak tanggal. */
    orientasi?: 'portrait' | 'landscape';
  },
) {
  ws.pageSetup = {
    paperSize: 9,                 // A4
    orientation: opsi.orientasi ?? 'landscape',
    fitToPage: true,
    fitToWidth: opsi.halamanLebar,
    fitToHeight: 0,               // setinggi apa pun boleh
    horizontalCentered: true,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    // 0 = jangan ulang baris judul sama sekali. Dipakai lembar yang berisi
    // beberapa bagian (satu per kelas), yang masing-masing sudah membawa kop
    // dan baris judulnya sendiri — mengulang judul bagian pertama di halaman
    // kelas berikutnya justru salah.
    ...(opsi.barisJudulTabel > 0
      ? { printTitlesRow: `${opsi.barisJudulTabel}:${opsi.barisJudulTabel}` }
      : {}),
    ...(opsi.ulangKolom ? { printTitlesColumn: opsi.ulangKolom } : {}),
  };
  ws.headerFooter = {
    oddFooter: '&LDicetak &D &T&RHalaman &P dari &N',
  };
}

function gayaHeaderTabel(baris: ExcelJS.Row) {
  baris.font = { bold: true, size: 10 };
  baris.alignment = { horizontal: 'center', vertical: 'middle' };
  baris.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } };
    c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
  });
}

/**
 * Laporan presensi harian, DIKELOMPOKKAN PER KELAS.
 *
 * Tiap kelas punya kop dan ringkasannya sendiri, dan halaman cetaknya dipaksa
 * berganti di tiap pergantian kelas (permintaan pemilik proyek, 13 September
 * 2026) — sama seperti versi PDF-nya. Lembarannya memang dipisah lalu
 * diserahkan ke wali kelas masing-masing, dan itu mustahil kalau satu halaman
 * memuat ekor VII-A sekaligus kepala VII-B.
 *
 * Kolom "Kelas" ikut hilang: nama kelasnya sudah ada di kop tiap bagian.
 */
export async function harianKeExcel(tanggal: string, kelasId?: string): Promise<Buffer> {
  const [data, sekolah] = await Promise.all([
    lap.harianPerKelas(tanggal, kelasId),
    ambilSetting('sekolah'),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'SIKLON';
  const ws = wb.addWorksheet('Laporan Harian');

  const LEBAR = [5, 12, 30, 9, 9, 12, 8, 11, 44];
  ws.columns = LEBAR.map((width) => ({ width }));

  // Barisnya datang terurut nama kelas dari SQL; siswa tanpa kelas tetap
  // dicetak di bagiannya sendiri, bukan dibuang diam-diam.
  const kelompok = new Map<string, typeof data.baris>();
  for (const b of data.baris) {
    const kunci = b.kelas ?? 'Tanpa Kelas';
    if (!kelompok.has(kunci)) kelompok.set(kunci, []);
    kelompok.get(kunci)!.push(b);
  }
  if (kelompok.size === 0) kelompok.set(data.kelas?.nama ?? 'Tanpa Kelas', []);

  let barisJudulPertama = 0;
  const pemisahHalaman: number[] = [];

  for (const [namaKelas, baris] of kelompok) {
    if (barisJudulPertama > 0) {
      ws.addRow([]);
      // Dicatat SEBELUM kop bagian berikutnya ditulis, supaya pemisahnya jatuh
      // tepat di atas kop itu — bukan membelah tabel kelas sebelumnya.
      pemisahHalaman.push(ws.rowCount);
    }

    kepala(ws, [
      sekolah.nama.toUpperCase(),
      'LAPORAN PRESENSI HARIAN',
      `Kelas ${namaKelas} — ${tanggal}`,
    ], LEBAR.length);

    // Ringkasan dihitung per kelas: lembaran ini berdiri sendiri di tangan
    // wali kelasnya, jadi angkanya harus tentang kelas itu.
    const n = (st: string) => baris.filter((b) => b.status === st).length;
    const tercatat = baris.length - n('BELUM');
    const hadirTotal = n('HADIR') + n('TERLAMBAT');
    const ringkas = ws.addRow([
      `Total ${baris.length}`, `Hadir ${n('HADIR')}`, `Terlambat ${n('TERLAMBAT')}`,
      `Izin ${n('IZIN')}`, `Sakit ${n('SAKIT')}`, `Alpa ${n('ALPA')}`,
      `Belum ${n('BELUM')}`,
      `Kehadiran ${tercatat > 0 ? ((hadirTotal / tercatat) * 100).toFixed(1) : '-'}%`,
    ]);
    ringkas.font = { bold: true, size: 10 };
    ws.addRow([]);

    const barisJudul = ws.rowCount + 1;
    if (barisJudulPertama === 0) barisJudulPertama = barisJudul;
    gayaHeaderTabel(
      ws.addRow(['No', 'NIS', 'Nama Siswa', 'Masuk', 'Pulang', 'Status', 'Telat', 'Titik Scan', 'Keterangan']),
    );

    baris.forEach((b, i) => {
      const r = ws.addRow([
        i + 1, b.nis, b.nama, b.jam_masuk ?? '-', b.jam_pulang ?? '-',
        b.status, b.terlambat > 0 ? `${b.terlambat} m` : '-',
        b.titik_scan ?? '-',
        [b.catatan, b.diubah_manual ? '(diubah manual)' : null].filter(Boolean).join(' '),
      ]);
      const warna = WARNA[b.status];
      if (warna) r.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: warna } };
      r.eachCell((c) => {
        c.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
        c.font = { size: 10 };
      });
    });
  }

  // Keterangan bisa panjang ("Surat izin dari orang tua (diubah manual)").
  // Tanpa wrapText ia meluber melewati tepi kertas dan terpotong saat dicetak.
  ws.getColumn(LEBAR.length).alignment = { wrapText: true, vertical: 'top' };

  for (const nomor of pemisahHalaman) ws.getRow(nomor).addPageBreak();

  /*
   * `printTitlesRow` sengaja TIDAK dipakai di sini.
   *
   * Ia mengulang satu baris judul yang sama di SEMUA halaman — benar untuk
   * satu tabel panjang, salah untuk lembar berisi banyak kelas: halaman VII-B
   * akan mengulang baris judul milik VII-A. Tiap bagian sudah membawa kop dan
   * baris judulnya sendiri.
   */
  siapCetak(ws, { barisJudulTabel: 0, halamanLebar: 1 });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function bulananKelasKeExcel(bulan: string, kelasId: string): Promise<Buffer> {
  const [data, sekolah] = await Promise.all([
    lap.bulananPerKelas(bulan, kelasId),
    ambilSetting('sekolah'),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'SIKLON';
  const ws = wb.addWorksheet(`Rekap ${bulan}`);

  const lebar = 3 + data.jumlahHari + 6;
  ws.getColumn(1).width = 4;
  ws.getColumn(2).width = 12;
  ws.getColumn(3).width = 28;
  // Selebar 'HH:MM' karena selnya kini memuat jam masuk & pulang, bukan satu huruf.
  for (let d = 0; d < data.jumlahHari; d++) ws.getColumn(4 + d).width = 6.5;
  for (let k = 0; k < 6; k++) ws.getColumn(4 + data.jumlahHari + k).width = 6;

  kepala(ws, [
    sekolah.nama.toUpperCase(),
    'REKAP PRESENSI BULANAN',
    `Kelas ${data.kelas.nama} — ${bulan}`,
    `${data.hariEfektif.length} hari efektif`,
  ], lebar, 'left');

  const judul = ['No', 'NIS', 'Nama Siswa'];
  for (let d = 1; d <= data.jumlahHari; d++) judul.push(String(d));
  judul.push('H', 'T', 'I', 'S', 'A', '%');
  const barisJudulBulanan = ws.rowCount + 1;
  gayaHeaderTabel(ws.addRow(judul));

  const warnaKode: Record<string, string> = {
    H: WARNA['HADIR']!, T: WARNA['TERLAMBAT']!, I: WARNA['IZIN']!,
    S: WARNA['SAKIT']!, A: WARNA['ALPA']!, L: 'FFE2E8F0', '-': 'FFFFFFFF',
  };

  data.baris.forEach((b, i) => {
    const nilai: (string | number)[] = [i + 1, b.nis, b.nama];
    /*
     * Hari yang siswanya benar-benar scan diisi "masuk↵pulang", bukan sekadar
     * huruf status — inilah yang dicari wali kelas saat memeriksa rekap.
     * Status tanpa jam (izin, sakit, alpa, libur) tetap hurufnya.
     */
    b.sel.forEach((s) => {
      if (s.jamMasuk || s.jamPulang) nilai.push(`${s.jamMasuk ?? '—'}\n${s.jamPulang ?? '—'}`);
      else nilai.push(s.kode === '-' ? '' : s.kode);
    });
    nilai.push(b.hadir, b.terlambat, b.izin, b.sakit, b.alpa, b.persenHadir ?? '-');
    const baris = ws.addRow(nilai);

    b.sel.forEach((s, idx) => {
      const c = baris.getCell(4 + idx);
      // wrapText wajib: tanpa itu "07:05\n13:10" tampil sebagai satu baris
      // panjang dan kolomnya jadi tidak terbaca.
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.font = { size: 8, bold: s.kode !== 'L' };
      const w = warnaKode[s.kode];
      if (w) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: w } };
    });
    baris.eachCell((c) => {
      c.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
    });
  });

  ws.addRow([]);
  /*
   * Legenda ditulis sebagai SATU sel yang digabung, bukan disebar ke tujuh
   * kolom. Kolom "No" cuma selebar 4 karakter, jadi "Legenda:" terpotong jadi
   * "Legen" dan menempel ke teks kolom sebelahnya saat dicetak.
   */
  const legenda = ws.addRow([
    'Legenda:  H = Hadir   T = Terlambat   I = Izin   S = Sakit   A = Alpa   L = Libur   ' +
      '(sel berisi dua baris = jam masuk di atas, jam pulang di bawah)',
  ]);
  legenda.font = { size: 9, italic: true };
  legenda.alignment = { horizontal: 'left' };
  ws.mergeCells(legenda.number, 1, legenda.number, lebar);

  // Baris judul dibekukan supaya nama siswa tetap terlihat saat digeser ke kanan.
  ws.views = [{ state: 'frozen', xSplit: 3, ySplit: ws.rowCount - data.baris.length - 2 }];

  /*
   * DUA halaman lebar, bukan satu.
   *
   * Sebulan penuh dengan jam masuk & pulang butuh sekitar 280 karakter lebar;
   * dipaksa muat satu halaman A4 mendatar, skalanya turun ke ±43% dan angkanya
   * tidak terbaca lagi. Dua halaman memberi ±86% — masih terbaca, dan kolom
   * No/NIS/Nama diulang di halaman kedua sehingga tetap jelas barisnya milik siapa.
   */
  siapCetak(ws, { barisJudulTabel: barisJudulBulanan, halamanLebar: 2, ulangKolom: 'A:C' });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/**
 * Rekap sebulan untuk SATU siswa.
 *
 * Pasangan Excel dari `bulananSiswaKePdf`. PDF-nya untuk dicetak apa adanya;
 * yang ini untuk diolah — wali kelas sering menyalin baris tertentu ke surat
 * pemanggilan, atau menjumlah sendiri keterlambatannya.
 *
 * Tegak, bukan mendatar: tabelnya cuma tujuh kolom dan barisnya sepanjang
 * jumlah hari dalam bulan, jadi kertas tegak memuat sebulan penuh dalam satu
 * lembar.
 */
export async function bulananSiswaKeExcel(bulan: string, siswaId: string): Promise<Buffer> {
  const [data, sekolah] = await Promise.all([
    lap.bulananPerSiswa(bulan, siswaId),
    ambilSetting('sekolah'),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'SIKLON';
  const ws = wb.addWorksheet(`Rekap ${bulan}`);

  const s = data.siswa;
  const r = data.ringkasan;
  const LEBAR = [6, 14, 12, 11, 11, 8, 34];
  LEBAR.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  kepala(ws, [
    sekolah.nama.toUpperCase(),
    'REKAP PRESENSI BULANAN',
    `${s.nama} — NIS ${s.nis} — Kelas ${s.kelas ?? '-'}`,
    `Periode ${bulan} — ${data.hariEfektif} hari efektif`,
  ], LEBAR.length, 'left');

  const ringkas = ws.addRow([
    `Hadir ${r.hadir}   Terlambat ${r.terlambat}   Izin ${r.izin}   Sakit ${r.sakit}   ` +
      `Alpa ${r.alpa}   Belum tercatat ${r.belumTercatat}   Kehadiran ${r.persenHadir ?? '-'}%   ` +
      `Total keterlambatan ${r.totalMenitTerlambat} menit`,
  ]);
  ringkas.font = { size: 9 };
  ws.mergeCells(ringkas.number, 1, ringkas.number, LEBAR.length);
  ws.addRow([]);

  const barisJudul = ws.rowCount + 1;
  gayaHeaderTabel(
    ws.addRow(['Tgl', 'Hari Sekolah', 'Status', 'Jam Masuk', 'Jam Pulang', 'Telat', 'Keterangan']),
  );

  for (const k of data.kalender) {
    const baris = ws.addRow([
      k.tanggal,
      k.hariSekolah ? 'Ya' : 'Tidak',
      k.status ?? (k.hariSekolah ? '-' : ''),
      k.jamMasuk ?? '-',
      k.jamPulang ?? '-',
      k.terlambat > 0 ? k.terlambat : '-',
      k.libur ? `Libur: ${k.libur}` : (k.catatan ?? ''),
    ]);
    baris.font = { size: 10 };
    baris.alignment = { vertical: 'middle' };
    for (const kolom of [1, 2, 3, 4, 5, 6]) {
      baris.getCell(kolom).alignment = { horizontal: 'center', vertical: 'middle' };
    }
    // Hari bukan sekolah diabukan supaya akhir pekan tidak terbaca sebagai
    // data yang hilang.
    const warna = !k.hariSekolah ? WARNA['BELUM'] : k.status ? WARNA[k.status] : undefined;
    if (warna) {
      baris.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: warna } };
      });
    }
    baris.eachCell((c) => {
      c.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
    });
  }

  ws.views = [{ state: 'frozen', ySplit: barisJudul }];
  siapCetak(ws, { barisJudulTabel: barisJudul, halamanLebar: 1, orientasi: 'portrait' });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
