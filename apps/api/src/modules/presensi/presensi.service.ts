
function combineDateAndTime(dateObj: Date, timeStr?: string): Date | null {
  if (!timeStr) return null;
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return new Date(`${yyyy}-${mm}-${dd}T${timeStr}:00+07:00`);
}

import type { KejadianWa } from '@siklon/shared';
import { prisma } from '../../lib/prisma.js';
import { BadRequest, NotFound } from '../../lib/errors.js';
import { jamLokal, kolomDateKeTanggal, tanggalKeKolomDate } from '../../lib/waktu.js';
import { antrekanAman } from '../whatsapp/antrean.service.js';

/**
 * Presensi satu kelas pada satu tanggal.
 *
 * Memakai LEFT JOIN dari sisi SISWA, bukan dari tabel attendance. Kalau
 * dibalik, siswa yang belum scan tidak akan muncul sama sekali — padahal
 * justru mereka yang paling perlu dilihat operator.
 */
export async function harian(tanggal: string, kelasId?: string) {
  const tgl = tanggalKeKolomDate(tanggal);

  const siswa = await prisma.students.findMany({
    where: { is_active: true, ...(kelasId ? { class_id: kelasId } : {}) },
    orderBy: { full_name: 'asc' },
    select: {
      id: true,
      nis: true,
      full_name: true,
      classes: { select: { id: true, name: true } },
      notify: true,
      attendance: {
        where: { attendance_date: tgl },
        select: {
          id: true,
          status: true,
          check_in_at: true,
          check_out_at: true,
          late_minutes: true,
          device_code: true,
          note: true,
          attachment_path: true,
          updated_by: true,
        },
      },
    },
  });

  const baris = siswa.map((s) => {
    const a = s.attendance[0];
    return {
      siswaId: s.id,
      nis: s.nis,
      nama: s.full_name,
      kelas: s.classes?.name ?? null,
      notifikasiAktif: s.notify,
      presensiId: a?.id?.toString() ?? null,
      status: a?.status ?? 'BELUM',
      jamMasuk: a?.check_in_at ? jamLokal(a.check_in_at) : null,
      jamPulang: a?.check_out_at ? jamLokal(a.check_out_at) : null,
      terlambatMenit: a?.late_minutes ?? 0,
      titikScan: a?.device_code ?? null,
      catatan: a?.note ?? null,
      diubahManual: Boolean(a?.updated_by),
      punyaLampiran: Boolean(a?.attachment_path),
    };
  });

  const hitung = (st: string) => baris.filter((b) => b.status === st).length;
  const hadirTotal = hitung('HADIR') + hitung('TERLAMBAT');
  const sudahTercatat = baris.length - hitung('BELUM');

  return {
    tanggal,
    ringkasan: {
      total: baris.length,
      hadir: hitung('HADIR'),
      terlambat: hitung('TERLAMBAT'),
      izin: hitung('IZIN'),
      sakit: hitung('SAKIT'),
      alpa: hitung('ALPA'),
      belum: hitung('BELUM'),
      persenHadir: sudahTercatat > 0 ? Number(((hadirTotal / sudahTercatat) * 100).toFixed(1)) : null,
    },
    baris,
  };
}

/**
 * Ubah status jadi IZIN atau SAKIT (atau kembalikan ke hasil scan).
 * Ini yang menggantikan alur pengajuan izin — admin mengubahnya langsung
 * dari laporan harian.
 */

export async function ubahStatus(
  presensiId: bigint,
  data: {
    status: 'IZIN' | 'SAKIT' | 'ALPA' | 'HADIR' | 'TERLAMBAT';
    catatan: string;
    jamMasuk?: string;
    jamPulang?: string;
    kirimWa?: boolean;
  },
  olehUserId: string,
) {
  const ada = await prisma.attendance.findUnique({ where: { id: presensiId } });
  if (!ada) throw NotFound('Data presensi tidak ditemukan');

  if (!data.catatan.trim()) throw BadRequest('Catatan wajib diisi saat mengubah status presensi');

  const tidakHadir = data.status === 'IZIN' || data.status === 'SAKIT' || data.status === 'ALPA';

  const updateData: any = {
    status: data.status,
    note: data.catatan.trim(),
    updated_by: olehUserId,
  };
  
  if (tidakHadir) {
    updateData.check_in_at = null;
    updateData.check_out_at = null;
    updateData.late_minutes = 0;
  } else {
    // Gunakan try-catch untuk debugging jika ternyata Invalid Date menyebabkan error
    try {
        if (data.jamMasuk !== undefined) updateData.check_in_at = combineDateAndTime(ada.attendance_date, data.jamMasuk);
        if (data.jamPulang !== undefined) updateData.check_out_at = combineDateAndTime(ada.attendance_date, data.jamPulang);
    } catch (e: any) {
        throw new Error("Gagal parsing waktu: " + e.message);
    }
  }

  const updated = await prisma.attendance.update({
    where: { id: presensiId },
    data: updateData,
  });

  if (data.kirimWa) {
    const kejadianMap: Record<string, KejadianWa> = {
      HADIR: 'MASUK',
      TERLAMBAT: 'TERLAMBAT',
      ALPA: 'ALPA',
      IZIN: 'IZIN',
      SAKIT: 'SAKIT',
    };
    const kejadian = kejadianMap[data.status] ?? 'MASUK';
    const tglPresensi = ada.attendance_date ? new Date(ada.attendance_date) : new Date();
    const sekarang = new Date();
    tglPresensi.setHours(sekarang.getHours(), sekarang.getMinutes(), sekarang.getSeconds());

    await antrekanAman({
      siswaId: ada.student_id,
      kejadian,
      waktu: updateData.check_in_at ?? tglPresensi,
      menitTerlambat: updateData.late_minutes ?? 0,
      catatan: data.catatan.trim(),
      presensiId,
      abaikanKirimSaat: true,
    });
  }

  return updated;
}

export async function hapusPresensi(id: bigint, userId: string) {
  const ada = await prisma.attendance.findUnique({ where: { id } });
  if (!ada) throw NotFound('Data presensi tidak ditemukan');

  await prisma.attendance.delete({ where: { id } });
  return { pesan: 'Berhasil dihapus' };
}
export async function tandaiTanpaScan(
  siswaId: string,
  tanggal: string,
  data: {
    status: 'IZIN' | 'SAKIT' | 'ALPA' | 'HADIR' | 'TERLAMBAT';
    catatan: string;
    jamMasuk?: string;
    jamPulang?: string;
    kirimWa?: boolean;
  },
  olehUserId: string,
) {
  const tgl = tanggalKeKolomDate(tanggal);
  const tidakHadir = data.status === 'IZIN' || data.status === 'SAKIT' || data.status === 'ALPA';

  let checkIn = null;
  let checkOut = null;
  if (!tidakHadir) {
    if (data.jamMasuk) checkIn = combineDateAndTime(tgl, data.jamMasuk);
    if (data.jamPulang) checkOut = combineDateAndTime(tgl, data.jamPulang);
  }

  const s = await prisma.students.findUnique({ where: { id: siswaId } });
  if (!s) throw NotFound('Siswa tidak ditemukan');

  const row = await prisma.attendance.upsert({
    where: {
      student_id_attendance_date: {
        student_id: siswaId,
        attendance_date: tgl,
      },
    },
    update: {
      status: data.status,
      note: data.catatan.trim(),
      updated_by: olehUserId,
      check_in_at: checkIn,
      check_out_at: checkOut,
      late_minutes: 0,
      class_id: s.class_id,
    },
    create: {
      student_id: siswaId,
      attendance_date: tgl,
      status: data.status,
      note: data.catatan.trim(),
      updated_by: olehUserId,
      check_in_at: checkIn,
      check_out_at: checkOut,
      late_minutes: 0,
      class_id: s.class_id,
      device_code: 'MANUAL',
    },
  });

  if (data.kirimWa) {
    const kejadianMap: Record<string, KejadianWa> = {
      HADIR: 'MASUK',
      TERLAMBAT: 'TERLAMBAT',
      ALPA: 'ALPA',
      IZIN: 'IZIN',
      SAKIT: 'SAKIT',
    };
    const kejadian = kejadianMap[data.status] ?? 'MASUK';
    const tglPresensi = new Date(tgl);
    const sekarang = new Date();
    tglPresensi.setHours(sekarang.getHours(), sekarang.getMinutes(), sekarang.getSeconds());

    await antrekanAman({
      siswaId,
      kejadian,
      waktu: checkIn ?? tglPresensi,
      catatan: data.catatan.trim(),
      presensiId: row.id,
      abaikanKirimSaat: true,
    });
  }

  return row;
}

export async function riwayatSiswa(id: string, dari?: string, sampai?: string) {
  const where: any = { student_id: id };
  if (dari || sampai) {
    where.attendance_date = {};
    if (dari) where.attendance_date.gte = tanggalKeKolomDate(dari);
    if (sampai) where.attendance_date.lte = tanggalKeKolomDate(sampai);
  }

  return prisma.attendance.findMany({
    where,
    orderBy: { attendance_date: 'desc' },
  });
}
