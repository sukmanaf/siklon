import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { prisma } from '../../lib/prisma.js';
import { BadRequest } from '../../lib/errors.js';
import { ambil as ambilSetting } from '../settings/settings.service.js';

/** Ukuran kartu ID-1 (seperti KTP/ATM) dalam poin PDF: 85,6 x 54 mm. */
const KARTU_L = (85.6 / 25.4) * 72;
const KARTU_T = (54 / 25.4) * 72;
const MARGIN = 28;
const JARAK = 10;

type SiswaKartu = {
  nis: string;
  full_name: string;
  kelas: string | null;
};

/**
 * Cetak kartu QR massal, 8 kartu per lembar A4 (2 kolom x 4 baris).
 *
 * Isi QR adalah NIS apa adanya — itu keputusan desain proyek ini, sehingga
 * kartu bisa dicetak ulang kapan saja tanpa menyentuh database.
 */
export async function cetakKartuQr(opsi: {
  kelasId?: string;
  siswaIds?: string[];
}): Promise<Buffer> {
  const where = opsi.siswaIds?.length
    ? { id: { in: opsi.siswaIds } }
    : opsi.kelasId
      ? { class_id: opsi.kelasId, is_active: true }
      : null;

  if (!where) throw BadRequest('Tentukan kelasId atau daftar siswaIds');

  const siswa = await prisma.students.findMany({
    where,
    orderBy: { full_name: 'asc' },
    select: {
      nis: true,
      full_name: true,
      classes: { select: { name: true } },
    },
  });

  if (siswa.length === 0) throw BadRequest('Tidak ada siswa yang cocok dengan pilihan ini');

  const sekolah = await ambilSetting('sekolah');
  const tahun = await prisma.academic_years.findFirst({ where: { is_active: true } });

  const daftar: SiswaKartu[] = siswa.map((s) => ({
    nis: s.nis,
    full_name: s.full_name,
    kelas: s.classes?.name ?? null,
  }));

  // Semua QR dibuat lebih dulu supaya penulisan PDF-nya tidak terputus-putus.
  const qr = await Promise.all(
    daftar.map((s) =>
      QRCode.toBuffer(s.nis, {
        errorCorrectionLevel: 'M',
        margin: 0,
        width: 240,
        type: 'png',
      }),
    ),
  );

  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, autoFirstPage: false });
  const potongan: Buffer[] = [];
  doc.on('data', (c: Buffer) => potongan.push(c));

  const selesai = new Promise<Buffer>((res) => {
    doc.on('end', () => res(Buffer.concat(potongan)));
  });

  const perHalaman = 8;
  for (let i = 0; i < daftar.length; i++) {
    if (i % perHalaman === 0) doc.addPage();

    const dalam = i % perHalaman;
    const kol = dalam % 2;
    const bar = Math.floor(dalam / 2);
    const x = MARGIN + kol * (KARTU_L + JARAK);
    const y = MARGIN + bar * (KARTU_T + JARAK);

    gambarKartu(doc, x, y, daftar[i]!, qr[i]!, {
      namaSekolah: sekolah.nama,
      tahunAjaran: tahun?.name ?? '',
    });
  }

  doc.end();
  return selesai;
}

function gambarKartu(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  s: SiswaKartu,
  qrPng: Buffer,
  info: { namaSekolah: string; tahunAjaran: string },
) {
  // Garis potong tipis — kartu dipotong manual setelah dicetak.
  doc.roundedRect(x, y, KARTU_L, KARTU_T, 6).lineWidth(0.5).strokeColor('#94a3b8').stroke();

  // Kepala kartu
  const tinggiKepala = 16;
  doc.save();
  doc.roundedRect(x, y, KARTU_L, tinggiKepala + 6, 6).fillColor('#4338ca').fill();
  doc.rect(x, y + tinggiKepala, KARTU_L, 6).fillColor('#4338ca').fill();
  doc.restore();

  doc
    .fillColor('#ffffff')
    .fontSize(6.5)
    .font('Helvetica-Bold')
    .text(info.namaSekolah.toUpperCase(), x + 6, y + 4, { width: KARTU_L - 12, ellipsis: true });
  doc
    .fontSize(4.5)
    .font('Helvetica')
    .text(`KARTU PELAJAR ${info.tahunAjaran}`, x + 6, y + 12, { width: KARTU_L - 12 });

  // QR di kanan
  const sisiQr = 46;
  const qrX = x + KARTU_L - sisiQr - 8;
  const qrY = y + tinggiKepala + 12;
  doc.image(qrPng, qrX, qrY, { width: sisiQr, height: sisiQr });

  // Identitas di kiri
  const kiriX = x + 8;
  const lebarKiri = KARTU_L - sisiQr - 24;
  let ty = y + tinggiKepala + 12;

  doc
    .fillColor('#0f172a')
    .fontSize(8)
    .font('Helvetica-Bold')
    .text(s.full_name, kiriX, ty, { width: lebarKiri, ellipsis: true, lineGap: -1 });

  ty += 14;
  doc.fontSize(5.5).font('Helvetica').fillColor('#475569');
  doc.text(`NIS   : ${s.nis}`, kiriX, ty, { width: lebarKiri });
  ty += 7;
  doc.text(`KELAS : ${s.kelas ?? '-'}`, kiriX, ty, { width: lebarKiri });

  // NIS dicetak juga di bawah QR sebagai jalan darurat: kalau QR-nya rusak
  // atau tergores, operator masih bisa memasukkannya manual.
  doc
    .fontSize(5)
    .fillColor('#334155')
    .font('Courier-Bold')
    .text(s.nis, qrX, qrY + sisiQr + 1.5, { width: sisiQr, align: 'center' });
}
