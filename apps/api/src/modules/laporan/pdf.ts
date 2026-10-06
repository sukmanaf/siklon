import PDFDocument from 'pdfkit';
import { ambil as ambilSetting } from '../settings/settings.service.js';
import { BULAN, tanggalPanjang } from '../whatsapp/template.js';
import { tanggalKeKolomDate } from '../../lib/waktu.js';
import * as lap from './laporan.service.js';

const MARGIN = 30;

/** "2026-09" -> "September 2026" */
function labelBulan(ym: string): string {
  const [th, bl] = ym.split('-');
  return `${BULAN[Number(bl) - 1] ?? bl} ${th}`;
}

/*
 * Seluruh laporan sengaja HITAM PUTIH.
 *
 * Alasannya: laporan presensi dicetak di pencetak laser sekolah yang hampir
 * selalu mono, jadi warna status yang cantik di layar keluar sebagai abu-abu
 * yang nyaris seragam — pembedanya hilang justru di kertas, tempat laporan ini
 * sebenarnya dipakai. Karena itu status dibedakan lewat HURUF dan tebal-tipis,
 * bukan warna, dan abu-abu hanya dipakai untuk hal struktural (baris judul,
 * hari libur, garis selang-seling).
 *
 * Orientasinya BERBEDA per laporan, mengikuti bentuk tabelnya:
 *
 *  - Harian, dan rekap bulanan per siswa: TEGAK. Kolomnya sedikit dan barisnya
 *    panjang, jadi kertas tegak memuat lebih banyak baris per lembar — sekelas
 *    32 siswa maupun sebulan penuh sama-sama selesai dalam satu lembar, dan
 *    bentuknya lazim untuk arsip surat.
 *  - Matriks bulanan per kelas: MENDATAR. Ia punya satu kolom per tanggal;
 *    ditegakkan, tiap kolom menyempit sampai jam masuk dan pulang tidak
 *    terbaca lagi.
 */
const HITAM = '#000000';
const ABU_TEKS = '#3f3f3f';
const ABU_JUDUL = '#d9d9d9';
const ABU_SELANG = '#f2f2f2';
const ABU_LIBUR = '#dcdcdc';
const ABU_GARIS = '#9a9a9a';

function buatDok(arah: 'portrait' | 'landscape' = 'portrait'): PDFKit.PDFDocument {
  return new PDFDocument({ size: 'A4', layout: arah, margin: MARGIN, bufferPages: true });
}

const lebarIsi = (doc: PDFKit.PDFDocument) => doc.page.width - MARGIN * 2;

function selesaikan(doc: PDFKit.PDFDocument): Promise<Buffer> {
  const potongan: Buffer[] = [];
  doc.on('data', (c: Buffer) => potongan.push(c));
  const janji = new Promise<Buffer>((res) => doc.on('end', () => res(Buffer.concat(potongan))));
  doc.end();
  return janji;
}

function kopSekolah(
  doc: PDFKit.PDFDocument,
  sekolah: { nama: string; alamat: string },
  judul: string,
  subjudul: string[],
) {
  doc.fillColor(HITAM).font('Helvetica-Bold').fontSize(13).text(sekolah.nama.toUpperCase(), { align: 'center' });
  if (sekolah.alamat) {
    doc.font('Helvetica').fontSize(8).fillColor(ABU_TEKS).text(sekolah.alamat, { align: 'center' });
  }
  doc.moveDown(0.3);
  const y = doc.y;
  doc.moveTo(MARGIN, y).lineTo(doc.page.width - MARGIN, y).lineWidth(1.2).strokeColor(HITAM).stroke();
  doc.moveDown(0.6);

  doc.fillColor(HITAM).font('Helvetica-Bold').fontSize(11).text(judul, { align: 'center' });
  doc.font('Helvetica').fontSize(9).fillColor(ABU_TEKS);
  for (const t of subjudul) doc.text(t, { align: 'center' });
  doc.fillColor(HITAM).moveDown(0.8);
}

/**
 * Kaki halaman: nomor halaman saja, di kanan bawah.
 *
 * Dijalankan di akhir lewat `bufferedPageRange()` karena jumlah halaman baru
 * diketahui setelah seluruh isi digambar — "Halaman 2 dari 4" mustahil ditulis
 * saat halaman 2 sedang dibuat.
 *
 * Cap "Dicetak dari SIKLON <waktu>" dibuang atas permintaan pemilik proyek
 * (13 September 2026). Ia tidak dipakai siapa pun di kertas, dan membuat dua
 * cetakan dari data yang sama terlihat berbeda hanya karena jamnya bergeser.
 */
function kakiHalaman(doc: PDFKit.PDFDocument) {
  const rentang = doc.bufferedPageRange();

  for (let i = 0; i < rentang.count; i++) {
    doc.switchToPage(rentang.start + i);

    /*
     * Margin bawah dinolkan selama menulis kaki halaman, lalu dikembalikan.
     *
     * Kaki halaman memang ditulis DI DALAM margin bawah, dan PDFKit menganggap
     * setiap teks yang melewati batas margin sebagai isi yang meluap lalu
     * menambah halaman baru sendiri. Akibatnya nomor halaman tidak pernah
     * tergambar dan lahir halaman kosong di belakang — laporan 2 lembar
     * keluar jadi 4. `lineBreak: false` saja tidak menahannya.
     */
    const bawah = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const y = doc.page.height - MARGIN + 8;
    doc.font('Helvetica').fontSize(7).fillColor(ABU_TEKS);
    doc.text(`Halaman ${i + 1} dari ${rentang.count}`, MARGIN, y, {
      width: lebarIsi(doc),
      align: 'right',
      lineBreak: false,
    });

    doc.page.margins.bottom = bawah;
  }
}

type Kolom = { judul: string; lebar: number; align?: 'left' | 'center' | 'right' };

type OpsiTabel = {
  /** Tinggi tiap baris; dinaikkan bila selnya memuat dua baris teks. */
  tinggiBaris?: number;
  /** Abu-abu selang-seling supaya mata tidak lompat baris di tabel panjang. */
  selangSeling?: boolean;
  /** Abu-abu untuk sel tertentu (mis. hari libur di matriks). */
  latarSel?: (baris: number, kolom: number) => string | null;
  tebalSel?: (baris: number, kolom: number) => boolean;
  /** Ruang yang harus tersisa di bawah tabel; bawaannya cuma kaki halaman. */
  sisakan?: number;
};

function tabel(doc: PDFKit.PDFDocument, kolom: Kolom[], baris: string[][], opsi: OpsiTabel = {}) {
  const tinggi = opsi.tinggiBaris ?? 14;
  /*
   * Cadangan di kaki halaman dibuat sekecil mungkin — cukup untuk nomor
   * halaman. Cadangan yang kebesaran memakan ruang di SETIAP lembar, bukan
   * cuma yang terakhir: pernah 118pt disisakan tiap halaman, dan di kertas
   * mendatar yang tingginya 595pt itu seperempat halaman, sehingga laporan
   * yang seharusnya dua lembar membengkak jadi empat.
   */
  const sisakan = opsi.sisakan ?? 18;
  const lebarTotal = kolom.reduce((t, k) => t + k.lebar, 0);
  const ukuranTeks = tinggi >= 18 ? 6.5 : 8;

  /** Garis tegak pemisah kolom — di matriks inilah yang membuat sel terbaca. */
  const garisKolom = (y: number, tinggiBaris: number) => {
    let x = MARGIN;
    doc.lineWidth(0.3).strokeColor(ABU_GARIS);
    for (const k of kolom) {
      doc.moveTo(x, y).lineTo(x, y + tinggiBaris).stroke();
      x += k.lebar;
    }
    doc.moveTo(x, y).lineTo(x, y + tinggiBaris).stroke();
  };

  const gambarHeader = () => {
    let x = MARGIN;
    const y = doc.y;
    doc.rect(MARGIN, y, lebarTotal, 16).fill(ABU_JUDUL);
    doc.fillColor(HITAM).font('Helvetica-Bold').fontSize(ukuranTeks);
    for (const k of kolom) {
      doc.text(k.judul, x + 2, y + 5, { width: k.lebar - 4, align: k.align ?? 'left', lineBreak: false });
      x += k.lebar;
    }
    garisKolom(y, 16);
    doc.moveTo(MARGIN, y + 16).lineTo(MARGIN + lebarTotal, y + 16).lineWidth(0.8).strokeColor(HITAM).stroke();
    doc.y = y + 16;
  };

  gambarHeader();

  baris.forEach((r, i) => {
    if (doc.y > doc.page.height - MARGIN - sisakan) {
      doc.addPage();
      gambarHeader();
    }
    const y = doc.y;

    if (opsi.selangSeling && i % 2 === 1) {
      doc.rect(MARGIN, y, lebarTotal, tinggi).fill(ABU_SELANG);
    }

    let x = MARGIN;
    r.forEach((sel, j) => {
      const k = kolom[j]!;
      const latar = opsi.latarSel?.(i, j);
      if (latar) doc.rect(x, y, k.lebar, tinggi).fill(latar);
      /*
       * `ellipsis` HANYA untuk sel satu baris.
       *
       * Sel matriks berisi "07:09\n13:22" — jam masuk di atas, jam pulang di
       * bawah. Dengan ellipsis menyala PDFKit memaksanya jadi satu baris lalu
       * memotongnya jadi "07:0…", sehingga justru jam yang dicari wali kelas
       * yang hilang. Untuk sel berbaris ganda, biarkan barisnya mengalir.
       */
      const duaBaris = sel.includes('\n');
      doc
        .fillColor(HITAM)
        .font(opsi.tebalSel?.(i, j) ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(ukuranTeks)
        .text(sel, x + 2, y + (duaBaris ? 2.5 : 3), {
          width: k.lebar - 4,
          height: tinggi - 3,
          align: k.align ?? 'left',
          ellipsis: !duaBaris,
          lineGap: duaBaris ? -1.5 : -1,
        });
      x += k.lebar;
    });

    garisKolom(y, tinggi);
    doc
      .moveTo(MARGIN, y + tinggi)
      .lineTo(MARGIN + lebarTotal, y + tinggi)
      .lineWidth(0.3)
      .strokeColor(ABU_GARIS)
      .stroke();
    doc.y = y + tinggi;
  });
}

/** Keterangan huruf status — wajib ada di matriks, yang isinya cuma huruf. */
function legenda(doc: PDFKit.PDFDocument, teks: string) {
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(7.5).fillColor(ABU_TEKS).text(teks, MARGIN, doc.y, {
    width: lebarIsi(doc),
  });
  doc.fillColor(HITAM);
}

/**
 * Laporan presensi harian, DIKELOMPOKKAN PER KELAS.
 *
 * Tiap kelas mulai di halaman baru dengan kop dan ringkasannya sendiri
 * (permintaan pemilik proyek, 13 September 2026). Sebelumnya seluruh sekolah
 * dicetak sebagai satu tabel panjang dengan kolom "Kelas" — dan itu tidak bisa
 * dipakai: lembarannya tidak bisa dipisah lalu diserahkan ke masing-masing
 * wali kelas, karena satu halaman bisa memuat ekor kelas VII-A sekaligus
 * kepala VII-B.
 *
 * Kolom "Kelas" ikut hilang: nama kelasnya sudah ada di kop tiap halaman, jadi
 * mengulangnya di setiap baris hanya memakan lebar yang lebih berguna untuk
 * nama siswa dan keterangan.
 */
export async function harianKePdf(tanggal: string, kelasId?: string): Promise<Buffer> {
  const [data, sekolah] = await Promise.all([
    lap.harianPerKelas(tanggal, kelasId),
    ambilSetting('sekolah'),
  ]);

  const doc = buatDok();

  /*
   * Barisnya sudah datang terurut nama kelas dari SQL, jadi pengelompokannya
   * cukup sekali jalan. Siswa tanpa kelas tetap dicetak — dikumpulkan di
   * bagiannya sendiri, bukan dibuang diam-diam.
   */
  const kelompok = new Map<string, typeof data.baris>();
  for (const b of data.baris) {
    const kunci = b.kelas ?? 'Tanpa Kelas';
    if (!kelompok.has(kunci)) kelompok.set(kunci, []);
    kelompok.get(kunci)!.push(b);
  }
  if (kelompok.size === 0) kelompok.set(data.kelas?.nama ?? 'Tanpa Kelas', []);

  const judulTanggal = tanggalPanjang(tanggalKeKolomDate(tanggal));
  let pertama = true;

  for (const [namaKelas, baris] of kelompok) {
    if (!pertama) doc.addPage();
    pertama = false;

    kopSekolah(doc, sekolah, 'LAPORAN PRESENSI HARIAN', [
      `Kelas ${namaKelas}`,
      judulTanggal,
    ]);

    // Ringkasan dihitung per kelas, bukan sekolah: lembaran ini akan berdiri
    // sendiri di tangan wali kelasnya, jadi angkanya harus tentang kelas itu.
    const n = (st: string) => baris.filter((b) => b.status === st).length;
    const tercatat = baris.length - n('BELUM');
    const hadirTotal = n('HADIR') + n('TERLAMBAT');
    const persen = tercatat > 0 ? ((hadirTotal / tercatat) * 100).toFixed(1) : '-';

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(HITAM)
      .text(
        `Total ${baris.length} siswa  •  Hadir ${n('HADIR')}  •  Terlambat ${n('TERLAMBAT')}  •  ` +
          `Izin ${n('IZIN')}  •  Sakit ${n('SAKIT')}  •  Alpa ${n('ALPA')}  •  ` +
          `Belum ${n('BELUM')}  •  Kehadiran ${persen}%`,
      );
    doc.moveDown(0.7);

    // Lebar kolom mengisi penuh lebar kertas tegak (535pt). Kolom terakhir
    // menyerap sisanya supaya tabel berhenti tepat di tepi kanan cetakan —
    // dihitung, bukan ditebak.
    const tetap: Kolom[] = [
      { judul: 'No', lebar: 24, align: 'center' },
      { judul: 'NIS', lebar: 62 },
      { judul: 'Nama Siswa', lebar: 160 },
      { judul: 'Masuk', lebar: 46, align: 'center' },
      { judul: 'Pulang', lebar: 46, align: 'center' },
      { judul: 'Status', lebar: 60, align: 'center' },
      { judul: 'Telat', lebar: 36, align: 'center' },
    ];
    const kolom: Kolom[] = [
      ...tetap,
      { judul: 'Keterangan', lebar: lebarIsi(doc) - tetap.reduce((t, k) => t + k.lebar, 0) },
    ];

    tabel(
      doc,
      kolom,
      baris.map((b, i) => [
        String(i + 1),
        b.nis,
        b.nama,
        b.jam_masuk ?? '-',
        b.jam_pulang ?? '-',
        b.status,
        b.terlambat > 0 ? `${b.terlambat}m` : '-',
        [b.catatan, b.diubah_manual ? '(diubah manual)' : null].filter(Boolean).join(' '),
      ]),
      {
        selangSeling: true,
        // Status kehilangan warnanya di cetakan mono, jadi yang butuh perhatian
        // ditebalkan: ALPA dan TERLAMBAT harus menonjol tanpa bantuan warna.
        tebalSel: (i, j) => j === 5 && ['ALPA', 'TERLAMBAT'].includes(baris[i]!.status),
      },
    );
  }

  kakiHalaman(doc);
  return selesaikan(doc);
}

/**
 * Matriks sebulan satu kelas: siswa ke bawah, tanggal ke samping.
 *
 * Tanggalnya dipecah jadi beberapa blok yang muat selembar, bukan dipaksa
 * masuk semua. Satu bulan penuh butuh 31 kolom, dan kalau dipaksa muat tiap
 * kolom tinggal ±15pt — terlalu sempit untuk "07:05", sehingga jam masuk dan
 * pulang terpaksa dibuang. Memecahnya jadi dua blok membuat jamnya tetap
 * terbaca, dan itu justru isi yang dicari wali kelas saat memeriksa rekap.
 */
export async function bulananKelasKePdf(bulan: string, kelasId: string): Promise<Buffer> {
  const [data, sekolah] = await Promise.all([
    lap.bulananPerKelas(bulan, kelasId),
    ambilSetting('sekolah'),
  ]);

  const doc = buatDok('landscape');

  const LEBAR_NO = 22;
  const LEBAR_NIS = 58;
  const LEBAR_HARI = 26; // cukup untuk "07:05" pada 6,5pt
  const LEBAR_REKAP = 21;
  const LEBAR_PERSEN = 34;

  const tetap = LEBAR_NO + LEBAR_NIS + LEBAR_REKAP * 5 + LEBAR_PERSEN;
  const muatSelembar = Math.max(1, Math.floor((lebarIsi(doc) - tetap - 90) / LEBAR_HARI));

  /*
   * Bloknya dibagi RATA, bukan diisi penuh lalu sisanya dijadikan blok kecil.
   * Sebulan 30 hari dengan 17 hari per lembar akan melahirkan blok kedua
   * berisi 13 hari — atau lebih buruk, blok ketiga berisi 2 hari: satu lembar
   * penuh nama siswa dengan dua kolom tanggal di sampingnya.
   */
  const jumlahBlok = Math.ceil(data.jumlahHari / muatSelembar);
  const hariPerBlok = Math.ceil(data.jumlahHari / jumlahBlok);

  const blok: number[][] = [];
  for (let d = 1; d <= data.jumlahHari; d += hariPerBlok) {
    blok.push(Array.from({ length: Math.min(hariPerBlok, data.jumlahHari - d + 1) }, (_, k) => d + k));
  }

  /*
   * Sisa lebar TIDAK semuanya diberikan ke kolom nama — dibatasi maksimal
   * segini. Blok yang harinya sedikit (mis. 21 hari terbagi rata jadi dua
   * blok 11 hari) menyisakan ratusan poin lebar; tanpa batas, kolom nama
   * jadi sangat lebar padahal nama siswa jarang lebih dari ini.
   */
  const LEBAR_NAMA_MAKS = 130;
  const lebarNama = (jumlahHari: number) =>
    Math.min(LEBAR_NAMA_MAKS, lebarIsi(doc) - tetap - jumlahHari * LEBAR_HARI);

  kopSekolah(doc, sekolah, 'REKAP PRESENSI BULANAN', [
    `Kelas ${data.kelas.nama}  •  ${labelBulan(bulan)}`,
    `${data.baris.length} siswa  •  ${data.hariEfektif.length} hari efektif`,
  ]);

  blok.forEach((hari, iBlok) => {
    if (iBlok > 0) {
      doc.addPage();
      doc.font('Helvetica-Bold').fontSize(10).fillColor(HITAM)
        .text(`Kelas ${data.kelas.nama} — ${labelBulan(bulan)} (lanjutan)`, { align: 'center' });
      doc.moveDown(0.6);
    }
    doc.font('Helvetica').fontSize(8).fillColor(ABU_TEKS)
      .text(`Tanggal ${hari[0]}–${hari[hari.length - 1]}`, { align: 'left' });
    doc.fillColor(HITAM).moveDown(0.3);

    const kolom: Kolom[] = [
      { judul: 'No', lebar: LEBAR_NO, align: 'center' },
      { judul: 'NIS', lebar: LEBAR_NIS },
      { judul: 'Nama Siswa', lebar: lebarNama(hari.length) },
      ...hari.map((d) => ({ judul: String(d), lebar: LEBAR_HARI, align: 'center' as const })),
      { judul: 'H', lebar: LEBAR_REKAP, align: 'center' as const },
      { judul: 'T', lebar: LEBAR_REKAP, align: 'center' as const },
      { judul: 'I', lebar: LEBAR_REKAP, align: 'center' as const },
      { judul: 'S', lebar: LEBAR_REKAP, align: 'center' as const },
      { judul: 'A', lebar: LEBAR_REKAP, align: 'center' as const },
      { judul: '%', lebar: LEBAR_PERSEN, align: 'center' as const },
    ];

    const isi = data.baris.map((b, i) => {
      const sel = hari.map((d) => {
        const s = b.sel[d - 1]!;
        // Hari yang siswanya benar-benar scan diisi "masuk↵pulang" — itulah
        // yang dicari wali kelas. Status tanpa jam tetap hurufnya.
        if (s.jamMasuk || s.jamPulang) return `${s.jamMasuk ?? '—'}\n${s.jamPulang ?? '—'}`;
        return s.kode === '-' ? '' : s.kode;
      });
      return [
        String(i + 1),
        b.nis,
        b.nama,
        ...sel,
        String(b.hadir), String(b.terlambat), String(b.izin), String(b.sakit), String(b.alpa),
        b.persenHadir === null ? '-' : `${b.persenHadir}%`,
      ];
    });

    const kolomHariPertama = 3;
    tabel(doc, kolom, isi, {
      tinggiBaris: 20,
      selangSeling: true,
      latarSel: (i, j) => {
        const d = hari[j - kolomHariPertama];
        if (d === undefined) return null;
        // Hari libur diabukan supaya blok akhir pekan langsung terlihat sebagai
        // kolom yang memang kosong, bukan data yang hilang.
        return data.baris[i]!.sel[d - 1]!.kode === 'L' ? ABU_LIBUR : null;
      },
      tebalSel: (i, j) => {
        const d = hari[j - kolomHariPertama];
        if (d === undefined) return false;
        return data.baris[i]!.sel[d - 1]!.kode === 'A';
      },
    });
  });

  legenda(
    doc,
    'Keterangan — Sel berisi dua baris: jam masuk (atas) dan jam pulang (bawah); “—” berarti tidak tercatat. ' +
      'H = Hadir, T = Terlambat, I = Izin, S = Sakit, A = Alpa (dicetak tebal), L = Libur (berlatar abu-abu), ' +
      'sel kosong = belum ada catatan. Kolom H/T/I/S/A dan % adalah rekap satu bulan penuh, diulang di tiap blok tanggal.',
  );

  kakiHalaman(doc);
  return selesaikan(doc);
}

export async function bulananSiswaKePdf(bulan: string, siswaId: string): Promise<Buffer> {
  const [data, sekolah] = await Promise.all([
    lap.bulananPerSiswa(bulan, siswaId),
    ambilSetting('sekolah'),
  ]);

  const doc = buatDok();
  const s = data.siswa;
  const r = data.ringkasan;

  kopSekolah(doc, sekolah, 'REKAP PRESENSI BULANAN', [
    `${s.nama}  •  NIS ${s.nis}  •  Kelas ${s.kelas ?? '-'}`,
    `Periode ${labelBulan(bulan)}  •  ${data.hariEfektif} hari efektif`,
  ]);

  doc.font('Helvetica').fontSize(9).fillColor(HITAM);
  doc.text(
    `Hadir ${r.hadir}  •  Terlambat ${r.terlambat}  •  Izin ${r.izin}  •  Sakit ${r.sakit}  •  ` +
      `Alpa ${r.alpa}  •  Belum tercatat ${r.belumTercatat}`,
  );
  doc.text(
    `Kehadiran ${r.persenHadir ?? '-'}%  •  Rata-rata jam datang ${r.rataJamDatang ?? '-'}  •  ` +
      `Total keterlambatan ${r.totalMenitTerlambat} menit`,
  );
  doc.moveDown(0.7);

  // Sama seperti laporan harian: kolom terakhir menyerap sisa lebar kertas
  // tegak (535pt) supaya tabelnya berhenti tepat di tepi kanan cetakan.
  const tetap: Kolom[] = [
    { judul: 'Tgl', lebar: 34, align: 'center' },
    { judul: 'Hari Sekolah', lebar: 70, align: 'center' },
    { judul: 'Status', lebar: 68, align: 'center' },
    { judul: 'Jam Masuk', lebar: 58, align: 'center' },
    { judul: 'Jam Pulang', lebar: 58, align: 'center' },
    { judul: 'Telat', lebar: 42, align: 'center' },
  ];

  tabel(
    doc,
    [
      ...tetap,
      { judul: 'Keterangan', lebar: lebarIsi(doc) - tetap.reduce((t, k) => t + k.lebar, 0) },
    ],
    data.kalender.map((k) => [
      String(k.tanggal),
      k.hariSekolah ? 'Ya' : 'Tidak',
      k.status ?? (k.hariSekolah ? '-' : ''),
      k.jamMasuk ?? '-',
      k.jamPulang ?? '-',
      k.terlambat > 0 ? `${k.terlambat}m` : '-',
      k.libur ? `Libur: ${k.libur}` : (k.catatan ?? ''),
    ]),
    {
      selangSeling: true,
      latarSel: (i, j) => (j === 1 && !data.kalender[i]!.hariSekolah ? ABU_LIBUR : null),
      tebalSel: (i, j) => j === 2 && ['ALPA', 'TERLAMBAT'].includes(data.kalender[i]!.status ?? ''),
    },
  );

  kakiHalaman(doc);
  return selesaikan(doc);
}
