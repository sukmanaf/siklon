import ExcelJS from 'exceljs';
import { normalkanNomor } from '@siklon/shared';
import { prisma } from '../../lib/prisma.js';
import { BadRequest } from '../../lib/errors.js';

/** Kolom yang diharapkan di berkas Excel. Urutan tidak wajib, judul yang dicocokkan. */
const KOLOM = {
  nis: ['nis'],
  nama: ['nama', 'nama siswa', 'nama lengkap'],
  kelas: ['kelas', 'rombel'],
  nomorWali: ['nomor wa', 'no wa', 'nomor whatsapp', 'whatsapp', 'no hp', 'nomor hp', 'telepon'],
} as const;

type Baris = {
  baris: number;
  nis: string;
  nama: string;
  kelas: string;
  nomorWali: string;
};

export type MasalahBaris = { baris: number; kolom: string; pesan: string };

function cariIndeksKolom(header: (string | null)[]) {
  const cari = (kandidat: readonly string[]) =>
    header.findIndex((h) => h != null && kandidat.includes(h.trim().toLowerCase()));

  const idx = {
    nis: cari(KOLOM.nis),
    nama: cari(KOLOM.nama),
    kelas: cari(KOLOM.kelas),
    nomorWali: cari(KOLOM.nomorWali),
  };

  const wajib: (keyof typeof idx)[] = ['nis', 'nama'];
  const hilang = wajib.filter((k) => idx[k] === -1);
  if (hilang.length) {
    throw BadRequest(
      `Kolom wajib tidak ditemukan di baris judul: ${hilang.join(', ')}. ` +
        `Judul yang terbaca: ${header.filter(Boolean).join(' | ')}`,
    );
  }
  return idx;
}

const teks = (v: ExcelJS.CellValue): string => {
  if (v == null) return '';
  if (typeof v === 'object' && 'text' in v) return String(v.text).trim();
  if (typeof v === 'object' && 'result' in v) return String(v.result ?? '').trim();
  return String(v).trim();
};

/**
 * Import siswa dari Excel.
 *
 * Sifatnya SEMUA-ATAU-TIDAK: bila ada satu baris bermasalah, tidak ada yang
 * tersimpan sama sekali. Import setengah jadi lebih buruk daripada gagal —
 * operator tidak tahu mana yang sudah masuk dan mana yang belum, lalu
 * mengulang import dan membuat data dobel.
 */
export async function importSiswa(buffer: Buffer, opsi: { hanyaPeriksa?: boolean } = {}) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);

  const ws = wb.worksheets[0];
  if (!ws) throw BadRequest('Berkas Excel tidak punya sheet apa pun');
  if (ws.rowCount < 2) throw BadRequest('Berkas hanya berisi baris judul, tidak ada data siswa');

  const header = (ws.getRow(1).values as ExcelJS.CellValue[]).map((v) =>
    v == null ? null : teks(v),
  );
  const idx = cariIndeksKolom(header);

  const masalah: MasalahBaris[] = [];
  const baris: Baris[] = [];
  const nisTerlihat = new Map<string, number>();

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const nilai = (i: number) => (i === -1 ? '' : teks(row.getCell(i).value));

    const b: Baris = {
      baris: r,
      nis: nilai(idx.nis),
      nama: nilai(idx.nama),
      kelas: nilai(idx.kelas),
      nomorWali: nilai(idx.nomorWali),
    };

    // Baris kosong di tengah/akhir berkas itu wajar, lewati tanpa mengeluh.
    if (!b.nis && !b.nama && !b.nomorWali) continue;

    if (!b.nis) masalah.push({ baris: r, kolom: 'NIS', pesan: 'NIS kosong' });
    else if (!/^[A-Za-z0-9]+$/.test(b.nis)) {
      masalah.push({ baris: r, kolom: 'NIS', pesan: `"${b.nis}" mengandung karakter selain huruf/angka` });
    } else if (nisTerlihat.has(b.nis)) {
      masalah.push({
        baris: r,
        kolom: 'NIS',
        pesan: `NIS "${b.nis}" dobel di dalam berkas ini (juga di baris ${nisTerlihat.get(b.nis)})`,
      });
    } else {
      nisTerlihat.set(b.nis, r);
    }

    if (!b.nama) masalah.push({ baris: r, kolom: 'Nama', pesan: 'Nama siswa kosong' });

    // Nomor wali opsional. Siswa tanpa nomor tetap boleh diimpor — presensinya
    // tercatat penuh, hanya notifikasinya yang tidak ada tujuan.
    if (b.nomorWali) {
      if (!normalkanNomor(b.nomorWali)) {
        masalah.push({
          baris: r,
          kolom: 'Nomor WA',
          pesan: `"${b.nomorWali}" bukan nomor Indonesia yang valid`,
        });
      }
    }

    baris.push(b);
  }

  if (baris.length === 0) throw BadRequest('Tidak ada baris data yang bisa dibaca');

  // Cek bentrok dengan data yang sudah ada di database
  const nisBaru = baris.map((b) => b.nis).filter(Boolean);
  const sudahAda = await prisma.students.findMany({
    where: { nis: { in: nisBaru } },
    select: { nis: true, full_name: true },
  });
  const petaAda = new Map(sudahAda.map((s) => [s.nis, s.full_name]));
  for (const b of baris) {
    if (petaAda.has(b.nis)) {
      masalah.push({
        baris: b.baris,
        kolom: 'NIS',
        pesan: `NIS "${b.nis}" sudah ada di database (${petaAda.get(b.nis)})`,
      });
    }
  }

  // Kelas harus sudah ada — membuat kelas otomatis dari salah tulis
  // ("VII-A " vs "VII A") akan melahirkan kelas hantu.
  const namaKelas = [...new Set(baris.map((b) => b.kelas).filter(Boolean))];
  const kelasDb = await prisma.classes.findMany({ where: { name: { in: namaKelas } } });
  const petaKelas = new Map(kelasDb.map((k) => [k.name, k.id]));
  for (const b of baris) {
    if (b.kelas && !petaKelas.has(b.kelas)) {
      masalah.push({
        baris: b.baris,
        kolom: 'Kelas',
        pesan: `Kelas "${b.kelas}" belum ada. Buat kelasnya dulu di halaman Kelas.`,
      });
    }
  }

  const ringkas = {
    totalBaris: baris.length,
    siapDiimpor: masalah.length === 0 ? baris.length : 0,
    jumlahMasalah: masalah.length,
    masalah: masalah.slice(0, 100),
    masalahDipotong: masalah.length > 100,
  };

  if (masalah.length > 0) {
    return { ...ringkas, tersimpan: false, pesan: 'Ada baris bermasalah. Tidak ada data yang disimpan.' };
  }
  if (opsi.hanyaPeriksa) {
    return { ...ringkas, tersimpan: false, pesan: 'Pemeriksaan lolos. Jalankan tanpa hanyaPeriksa untuk menyimpan.' };
  }

  // ---- Semua bersih: simpan dalam SATU transaksi ----
  //
  // Nomor wali disimpan langsung di baris siswa, jadi tidak ada lagi
  // deduplikasi wali. Kakak-adik memang akan punya nomor yang sama di dua
  // baris — itu bukan data dobel, dan opt-out tetap menemukan keduanya karena
  // mencari berdasarkan nomor.
  const hasil = await prisma.$transaction(async (tx) => {
    const siswa = await tx.students.createMany({
      data: baris.map((b) => ({
        nis: b.nis,
        full_name: b.nama,
        class_id: b.kelas ? (petaKelas.get(b.kelas) ?? null) : null,
        guardian_phone: b.nomorWali ? normalkanNomor(b.nomorWali) : null,
      })),
    });
    return { siswaDibuat: siswa.count };
  });

  const denganWali = baris.filter((b) => b.nomorWali).length;
  const nomorUnik = new Set(baris.filter((b) => b.nomorWali).map((b) => normalkanNomor(b.nomorWali)!)).size;

  return {
    ...ringkas,
    tersimpan: true,
    ...hasil,
    siswaDenganWali: denganWali,
    siswaTanpaWali: baris.length - denganWali,
    nomorWaliUnik: nomorUnik,
    pesan:
      `${hasil.siswaDibuat} siswa diimpor. ${denganWali} punya nomor wali ` +
      `(${nomorUnik} nomor berbeda), ${baris.length - denganWali} belum ada nomornya.`,
  };
}

/** Template Excel yang bisa diunduh operator. */
export async function buatTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Data Siswa');

  ws.columns = [
    { header: 'NIS', key: 'nis', width: 14 },
    { header: 'Nama Siswa', key: 'nama', width: 30 },
    { header: 'Kelas', key: 'kelas', width: 12 },
    { header: 'Nomor WA', key: 'wa', width: 18 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } };

  ws.addRow({
    nis: '2026001',
    nama: 'Andi Pratama',
    kelas: 'VII-A',
    wa: '081234567890',
  });

  const catatan = wb.addWorksheet('Petunjuk');
  catatan.columns = [{ width: 100 }];
  for (const t of [
    'PETUNJUK PENGISIAN',
    '',
    '1. NIS wajib diisi, hanya huruf dan angka (tanpa spasi atau tanda baca).',
    '   NIS inilah yang dicetak sebagai QR code di kartu siswa.',
    '2. Nama Siswa wajib diisi.',
    '3. Kelas harus sudah dibuat lebih dulu di halaman Kelas, ditulis sama persis (contoh: VII-A).',
    '4. Nomor WA boleh dikosongkan. Siswa tanpa nomor tetap tercatat presensinya, hanya walinya tidak dikabari.',
    '5. Nomor WA boleh format apa pun: 081234567890, 0812-3456-7890, atau +6281234567890.',
    '6. Satu wali dengan beberapa anak cukup ditulis nomor yang sama di tiap baris anaknya.',
    '   Nomor yang sama di beberapa baris itu NORMAL, bukan data dobel.',
    '',
    'PENTING: bila ada satu baris bermasalah, TIDAK ADA data yang disimpan.',
    'Perbaiki dulu semua yang dilaporkan, lalu unggah ulang.',
  ]) {
    catatan.addRow([t]);
  }
  catatan.getRow(1).font = { bold: true, size: 14 };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
