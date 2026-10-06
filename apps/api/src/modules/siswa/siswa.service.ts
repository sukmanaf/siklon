import { normalkanNomor } from '@siklon/shared';
import { prisma } from '../../lib/prisma.js';
import { BadRequest, Conflict, NotFound } from '../../lib/errors.js';
import { aktif as tahunAktif } from '../akademik/tahunAjaran.service.js';

const PILIH = {
  id: true,
  nis: true,
  full_name: true,
  photo_path: true,
  is_active: true,
  guardian_phone: true,
  notify: true,
  created_at: true,
  classes: { select: { id: true, name: true, grade_level: true } },
} as const;

export async function daftar(opsi: {
  cari?: string;
  kelasId?: string;
  aktif?: boolean;
  tanpaWali?: boolean;
  page?: number;
  perPage?: number;
}) {
  const page = Math.max(1, opsi.page ?? 1);
  const perPage = Math.min(200, Math.max(1, opsi.perPage ?? 25));

  const where = {
    ...(opsi.aktif !== undefined ? { is_active: opsi.aktif } : {}),
    ...(opsi.kelasId ? { class_id: opsi.kelasId } : {}),
    ...(opsi.tanpaWali ? { guardian_phone: null } : {}),
    ...(opsi.cari
      ? {
          OR: [
            // Index GIN trigram pada full_name membuat pencarian ini tetap
            // cepat walau siswanya ribuan.
            { full_name: { contains: opsi.cari, mode: 'insensitive' as const } },
            { nis: { contains: opsi.cari } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.students.findMany({
      where,
      select: PILIH,
      orderBy: { full_name: 'asc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.students.count({ where }),
  ]);

  return { items, total, page, perPage };
}

export async function detail(id: string) {
  const s = await prisma.students.findUnique({ where: { id }, select: PILIH });
  if (!s) throw NotFound('Siswa tidak ditemukan');
  return s;
}

export async function cariByNis(nis: string) {
  const s = await prisma.students.findUnique({ where: { nis }, select: PILIH });
  if (!s) throw NotFound(`Siswa dengan NIS ${nis} tidak ditemukan`);
  return s;
}

type DataSiswa = {
  nis: string;
  full_name: string;
  class_id?: string | null;
  guardian_phone?: string | null;
  notify?: boolean;
};

async function pastikanKelasValid(class_id?: string | null) {
  if (!class_id) return;
  const k = await prisma.classes.findUnique({ where: { id: class_id } });
  if (!k) throw BadRequest('Kelas yang dipilih tidak ditemukan');
}

/**
 * Nomor wali dinormalkan ke E.164 sebelum disimpan.
 *
 * Nomor ganda TIDAK ditolak: kakak-adik memang memakai nomor wali yang sama,
 * dan sejak tabel guardians dibuang itu berarti nomor yang sama tersimpan di
 * beberapa baris siswa. Yang penting bentuknya seragam, supaya opt-out bisa
 * menemukan semua anak dari satu nomor.
 */
function siapkanNomorWali(input?: string | null): string | null | undefined {
  if (input === undefined) return undefined;
  if (input === null || input.trim() === '') return null;
  const n = normalkanNomor(input);
  if (!n) {
    throw BadRequest(
      `Nomor wali "${input}" bukan nomor telepon Indonesia yang valid. Contoh benar: 081234567890`,
    );
  }
  return n;
}

export async function buat(data: DataSiswa) {
  const ada = await prisma.students.findUnique({ where: { nis: data.nis } });
  if (ada) {
    // NIS adalah isi QR kartu. Dua siswa dengan NIS sama berarti satu kartu
    // bisa mengabsenkan orang yang salah.
    throw Conflict(`NIS ${data.nis} sudah dipakai oleh "${ada.full_name}"`);
  }
  await pastikanKelasValid(data.class_id);

  return prisma.students.create({
    data: {
      nis: data.nis,
      full_name: data.full_name,
      class_id: data.class_id ?? null,
      guardian_phone: siapkanNomorWali(data.guardian_phone) ?? null,
      notify: data.notify ?? true,
    },
    select: PILIH,
  });
}

export async function ubah(id: string, data: Partial<DataSiswa> & { is_active?: boolean }) {
  await detail(id);

  if (data.nis) {
    const bentrok = await prisma.students.findFirst({ where: { nis: data.nis, id: { not: id } } });
    if (bentrok) throw Conflict(`NIS ${data.nis} sudah dipakai oleh "${bentrok.full_name}"`);
  }
  await pastikanKelasValid(data.class_id);

  const nomor = siapkanNomorWali(data.guardian_phone);
  return prisma.students.update({
    where: { id },
    data: { ...data, ...(nomor !== undefined ? { guardian_phone: nomor } : {}) },
    select: PILIH,
  });
}

/**
 * Siswa TIDAK pernah benar-benar dihapus bila sudah punya riwayat presensi —
 * menghapusnya akan menghapus catatan kehadirannya (ON DELETE CASCADE) dan
 * membuat laporan bulan-bulan lalu berubah angkanya.
 */
export async function nonaktifkan(id: string) {
  await detail(id);
  await prisma.students.update({ where: { id }, data: { is_active: false } });
  return { pesan: 'Siswa dinonaktifkan. Riwayat presensinya tetap tersimpan.' };
}

export async function hapus(id: string) {
  const s = await prisma.students.findUnique({
    where: { id },
    include: { _count: { select: { attendance: true } } },
  });
  if (!s) throw NotFound('Siswa tidak ditemukan');
  if (s._count.attendance > 0) {
    throw Conflict(
      `Siswa punya ${s._count.attendance} catatan presensi. Nonaktifkan saja — menghapusnya akan mengubah laporan bulan-bulan lalu.`,
    );
  }
  await prisma.students.delete({ where: { id } });
  return { pesan: 'Siswa dihapus' };
}

/** Ringkasan untuk dashboard & halaman siswa. */
export async function ringkasan() {
  const tahun = await tahunAktif();
  const [aktif, nonaktif, tanpaKelas, tanpaWali, tanpaNotify] = await Promise.all([
    prisma.students.count({ where: { is_active: true } }),
    prisma.students.count({ where: { is_active: false } }),
    prisma.students.count({ where: { is_active: true, class_id: null } }),
    prisma.students.count({ where: { is_active: true, guardian_phone: null } }),
    prisma.students.count({ where: { is_active: true, notify: false } }),
  ]);

  return {
    tahunAjaran: tahun.name,
    aktif,
    nonaktif,
    // Tiga angka di bawah ini adalah "lubang" yang membuat siswa tidak
    // terpantau: tanpa kelas berarti tidak muncul di laporan kelas, tanpa wali
    // atau notifikasi mati berarti orang tuanya tidak pernah dikabari.
    tanpaKelas,
    tanpaWali,
    notifikasiMati: tanpaNotify,
  };
}
