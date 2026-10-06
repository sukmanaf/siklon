import { normalkanNomor } from '@siklon/shared';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../config/logger.js';

/**
 * Kata kunci berhenti berlangganan. Dicocokkan longgar dengan sengaja: wali
 * murid bisa menulis "berhenti.", "BERHENTI", atau "stop berhenti ya".
 * Memaksa persamaan tepat berarti permintaan berhenti diabaikan — itu masalah
 * kepatuhan, sekaligus jalan tercepat menuju laporan spam.
 */
const KATA_BERHENTI = ['berhenti', 'stop', 'unsubscribe'];

export function mintaBerhenti(teks: string): boolean {
  const bersih = teks.toLowerCase().replace(/[^a-z\s]/g, ' ');
  return KATA_BERHENTI.some((k) => new RegExp(`\\b${k}\\b`).test(bersih));
}

/**
 * Tangani satu pesan masuk dari wali murid.
 *
 * PENTING sejak tabel guardians dibuang: nomor wali kini tersimpan per siswa,
 * jadi satu wali dengan dua anak punya dua baris. Opt-out harus mematikan
 * notifikasi di SEMUA baris dengan nomor itu — kalau hanya satu, wali yang
 * sudah minta berhenti tetap menerima pesan tentang anaknya yang lain.
 */
export async function tanganiPesanMasuk(dari: string, teks: string): Promise<void> {
  if (!mintaBerhenti(teks)) return;

  const nomor = normalkanNomor(dari);
  if (!nomor) return;

  const siswa = await prisma.students.findMany({
    where: { guardian_phone: nomor },
    select: { id: true, full_name: true, notify: true },
  });

  if (siswa.length === 0) {
    logger.warn({ nomor }, 'Permintaan berhenti dari nomor yang tidak terdaftar sebagai wali');
    return;
  }
  if (siswa.every((s) => !s.notify)) return;

  const { count } = await prisma.students.updateMany({
    where: { guardian_phone: nomor },
    data: { notify: false },
  });

  // Pesan yang masih menunggu di antrean untuk nomor ini dibatalkan. Tanpa ini,
  // wali yang baru minta berhenti masih menerima sisa antrean pagi itu.
  const dibatalkan = await prisma.wa_messages.updateMany({
    where: { phone: nomor, status: 'QUEUED' },
    data: { status: 'CANCELLED', last_error: 'Dibatalkan: wali murid meminta berhenti' },
  });

  logger.info(
    {
      siswa: siswa.map((x) => x.full_name).join(', '),
      siswaTerpengaruh: count,
      pesanDibatalkan: dibatalkan.count,
    },
    'Wali murid berhenti berlangganan notifikasi',
  );
}

/**
 * Nomor yang perlu diperbaiki: pesannya gagal terkirim.
 *
 * Sengaja TIDAK mematikan notifikasinya otomatis — kalau dimatikan sendiri,
 * wali itu diam-diam tidak pernah dikabari lagi dan tidak ada yang tahu.
 * Yang benar adalah melaporkannya supaya nomornya dibetulkan.
 */
export async function nomorBermasalah(minimalGagal = 2) {
  const gagal = await prisma.wa_messages.groupBy({
    by: ['phone'],
    // CANCELLED tidak dihitung: itu permintaan wali, bukan nomor bermasalah.
    where: { status: 'FAILED' },
    _count: { _all: true },
    _max: { created_at: true },
  });

  const kandidat = gagal.filter((g) => g._count._all >= minimalGagal);
  if (kandidat.length === 0) return [];

  const siswa = await prisma.students.findMany({
    where: { guardian_phone: { in: kandidat.map((k) => k.phone) } },
    select: {
      id: true,
      nis: true,
      full_name: true,
      guardian_phone: true,
      notify: true,
      classes: { select: { name: true } },
    },
  });

  const petaGagal = new Map(kandidat.map((k) => [k.phone, k]));

  // Dikelompokkan per nomor supaya kakak-adik muncul sebagai satu baris
  // masalah, bukan dua — yang perlu dibetulkan memang satu nomor.
  const perNomor = new Map<
    string,
    {
      nomor: string;
      notifikasiAktif: boolean;
      jumlahGagal: number;
      gagalTerakhir: Date | null;
      anak: { nis: string; nama: string; kelas: string | null }[];
    }
  >();

  for (const s of siswa) {
    const nomor = s.guardian_phone!;
    const g = petaGagal.get(nomor);
    if (!perNomor.has(nomor)) {
      perNomor.set(nomor, {
        nomor,
        notifikasiAktif: s.notify,
        jumlahGagal: g?._count._all ?? 0,
        gagalTerakhir: g?._max.created_at ?? null,
        anak: [],
      });
    }
    perNomor.get(nomor)!.anak.push({
      nis: s.nis,
      nama: s.full_name,
      kelas: s.classes?.name ?? null,
    });
  }

  return [...perNomor.values()].sort((a, b) => b.jumlahGagal - a.jumlahGagal);
}
