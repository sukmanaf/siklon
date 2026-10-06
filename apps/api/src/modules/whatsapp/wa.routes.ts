import { Router } from 'express';
import { z } from 'zod';
import { KEJADIAN_WA, normalkanNomor, samarkanNomor } from '@siklon/shared';
import { prisma } from '../../lib/prisma.js';
import { BadRequest, NotFound } from '../../lib/errors.js';
import { kirim, kirimHalaman } from '../../lib/respons.js';
import { ah } from '../../middlewares/asyncHandler.js';
import { wajibMasukPenuh } from '../../middlewares/auth.js';
import { ambilProvider, kirimSatu, ringkasanPengaman } from './pengirim.js';
import { putaranAman, statusAntrean } from './dispatcher.js';
import { pratinjau } from './template.js';
import { nomorBermasalah } from './optout.service.js';

export const waRouter = Router();
waRouter.use(...wajibMasukPenuh);

waRouter.get(
  '/status',
  ah(async (_req, res) => {
    const p = ambilProvider();
    return kirim(res, {
      provider: p.status(),
      antrean: await statusAntrean(),
      pengaman: ringkasanPengaman(),
    });
  }),
);

waRouter.post(
  '/connect',
  ah(async (_req, res) => {
    const p = ambilProvider();
    await p.sambungkan();
    const st = p.status();
    return kirim(res, {
      ...st,
      // QR dikirim sebagai teks mentah; frontend yang merendernya jadi gambar.
      pesan: st.qr
        ? 'Pindai QR ini dengan WhatsApp nomor SEKOLAH, bukan nomor pribadi.'
        : st.tersambung
          ? 'Sudah tersambung'
          : 'Menunggu QR, muat ulang beberapa saat lagi',
    });
  }),
);

waRouter.post(
  '/disconnect',
  ah(async (_req, res) => {
    await ambilProvider().putuskan();
    return kirim(res, { pesan: 'WhatsApp diputuskan' });
  }),
);

/**
 * Buang sesi supaya bisa ditautkan ke nomor lain.
 *
 * Dipisah dari /disconnect karena akibatnya berbeda jauh: /disconnect hanya
 * memutus, sesinya tetap tersimpan dan menyambung lagi tanpa QR. Ini membuang
 * kredensialnya, jadi nomor berikutnya bisa nomor yang sama sekali lain.
 *
 * Perlu ada di sini karena nomor Baileys memang barang habis pakai — kalau
 * kena blokir, sekolah harus bisa pindah nomor tanpa akses SSH ke server.
 */
waRouter.delete(
  '/session',
  ah(async (_req, res) => {
    const p = ambilProvider();
    if (!p.hapusSesi) {
      throw BadRequest(`Provider "${p.nama}" tidak menyimpan sesi, jadi tidak ada yang bisa dibuang`);
    }
    await p.hapusSesi();
    return kirim(res, {
      pesan: 'Sesi lama dibuang dan diarsipkan. Tekan Sambungkan, lalu pindai QR dengan nomor baru.',
    });
  }),
);

/** Jalankan satu putaran pengiriman sekarang, tanpa menunggu interval. */
waRouter.post(
  '/dispatch',
  ah(async (_req, res) => {
    const hasil = await putaranAman();
    return kirim(res, hasil ?? { pesan: 'Putaran lain sedang berjalan' });
  }),
);

waRouter.get(
  '/preview/:kejadian',
  ah(async (req, res) => {
    const { kejadian } = z.object({ kejadian: z.enum(KEJADIAN_WA) }).parse(req.params);
    return kirim(res, { kejadian, isi: await pratinjau(kejadian) });
  }),
);

waRouter.get(
  '/messages',
  ah(async (req, res) => {
    const q = z
      .object({
        status: z.enum(['QUEUED', 'SENT', 'FAILED', 'CANCELLED']).optional(),
        siswaId: z.uuid().optional(),
        page: z.coerce.number().int().positive().optional(),
        perPage: z.coerce.number().int().positive().max(200).optional(),
      })
      .parse(req.query);

    const page = q.page ?? 1;
    const perPage = q.perPage ?? 50;
    const where = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.siswaId ? { student_id: q.siswaId } : {}),
    };

    const [baris, total] = await Promise.all([
      prisma.wa_messages.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: { students: { select: { nis: true, full_name: true } } },
      }),
      prisma.wa_messages.count({ where }),
    ]);

    const items = baris.map((b) => ({
      id: b.id.toString(),
      // Nomor disamarkan di daftar: layar ini sering dibuka di ruang terbuka,
      // dan nomor wali murid adalah data pribadi.
      nomor: samarkanNomor(b.phone),
      siswa: b.students ? { nis: b.students.nis, nama: b.students.full_name } : null,
      kejadian: b.event,
      status: b.status,
      percobaan: b.attempts,
      errorTerakhir: b.last_error,
      dibuatPada: b.created_at,
      terkirimPada: b.sent_at,
      cuplikan: b.body.slice(0, 80).replace(/\n/g, ' '),
    }));

    return kirimHalaman(res, items, total, page, perPage);
  }),
);

/** Isi pesan lengkap dibuka terpisah supaya tidak ikut terbawa di daftar. */
waRouter.get(
  '/messages/:id',
  ah(async (req, res) => {
    const { id } = z.object({ id: z.coerce.bigint() }).parse(req.params);
    const b = await prisma.wa_messages.findUnique({ where: { id } });
    if (!b) throw NotFound('Pesan tidak ditemukan');
    return kirim(res, { ...b, id: b.id.toString(), nomor: b.phone, phone: undefined });
  }),
);

waRouter.post(
  '/messages/:id/retry',
  ah(async (req, res) => {
    const { id } = z.object({ id: z.coerce.bigint() }).parse(req.params);
    const b = await prisma.wa_messages.findUnique({ where: { id } });
    if (!b) throw NotFound('Pesan tidak ditemukan');
    if (b.status === 'SENT') throw BadRequest('Pesan ini sudah terkirim');

    // Percobaan direset supaya pesan yang sudah habis kesempatannya
    // benar-benar dicoba lagi, bukan langsung gagal.
    await prisma.wa_messages.update({
      where: { id },
      data: { status: 'QUEUED', attempts: 0, last_error: null },
    });
    return kirim(res, { pesan: 'Pesan dimasukkan kembali ke antrean' });
  }),
);

waRouter.post(
  '/messages/retry-failed',
  ah(async (_req, res) => {
    // Pesan yang dibatalkan karena opt-out TIDAK ikut dicoba lagi — wali murid
    // sudah menyatakan berhenti, dan mengirim ulang justru pelanggaran.
    const { count } = await prisma.wa_messages.updateMany({
      where: { status: 'FAILED' },
      data: { status: 'QUEUED', attempts: 0, last_error: null },
    });
    return kirim(res, { pesan: `${count} pesan dimasukkan kembali ke antrean`, jumlah: count });
  }),
);

waRouter.get(
  '/nomor-bermasalah',
  ah(async (req, res) => {
    const { minimal } = z
      .object({ minimal: z.coerce.number().int().min(1).max(50).optional() })
      .parse(req.query);
    return kirim(res, await nomorBermasalah(minimal ?? 2));
  }),
);

/** Kirim pesan uji ke satu nomor. Tetap lewat semua lapis pengaman. */
waRouter.post(
  '/test',
  ah(async (req, res) => {
    const { nomor, isi } = z
      .object({
        nomor: z.string().trim().min(1),
        isi: z.string().trim().min(1).max(1000).optional(),
      })
      .parse(req.body);

    const rapi = normalkanNomor(nomor);
    if (!rapi) throw BadRequest(`"${nomor}" bukan nomor Indonesia yang valid`);

    const hasil = await kirimSatu(
      rapi,
      isi ?? 'Uji coba notifikasi presensi SIKLON. Pesan ini dikirim manual oleh admin sekolah.',
    );
    return kirim(res, { ke: samarkanNomor(rapi), hasil });
  }),
);
