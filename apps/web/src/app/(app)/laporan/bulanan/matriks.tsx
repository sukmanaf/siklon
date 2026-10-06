'use client';

import { DownloadIcon, PrinterIcon } from 'lucide-react';
import { unduhan, type BulananKelas, type KodeSel } from '@/hooks/use-laporan';
import { cn } from '@/lib/utils';

/**
 * Warna sel matriks. Memakai token status yang sama dengan seluruh aplikasi,
 * jadi hijau di sini berarti hal yang sama dengan hijau di tabel harian.
 */
const GAYA: Record<KodeSel, { kelas: string; judul: string }> = {
  H: { kelas: 'bg-hadir-bg text-hadir', judul: 'Hadir' },
  T: { kelas: 'bg-terlambat-bg text-terlambat', judul: 'Terlambat' },
  I: { kelas: 'bg-izin-bg text-izin', judul: 'Izin' },
  S: { kelas: 'bg-sakit-bg text-sakit', judul: 'Sakit' },
  A: { kelas: 'bg-alpa-bg text-alpa', judul: 'Alpa' },
  L: { kelas: 'bg-libur-bg text-faint', judul: 'Libur / bukan hari sekolah' },
  '-': { kelas: 'text-faint', judul: 'Tidak ada data' },
};

/**
 * Matriks siswa × tanggal (FE-039).
 *
 * Kolom nama dibuat `sticky left-0` supaya tetap terlihat saat tabel digeser
 * ke kanan — tanpa itu, sel di tanggal 25 tidak ada artinya karena pembaca
 * kehilangan jejak barisnya milik siapa.
 */
export function MatriksBulanan({ data, bulan }: { data: BulananKelas; bulan: string }) {
  const hariLibur = new Map(data.hariLibur.map((l) => [l.tanggal, l.nama]));
  const hari = Array.from({ length: data.jumlahHari }, (_, i) => i + 1);
  const efektif = new Set(data.hariEfektif);

  // Lebar minimum dipatok supaya kolom tanggal tidak menyusut sampai tak
  // terbaca saat kelasnya besar — matriks yang muat di layar tapi tidak bisa
  // dibaca tidak ada gunanya. Konsekuensinya tabel digeser mendatar, dan itu
  // sebabnya kolom nama dibuat sticky.
  const LEBAR_SISWA = 250;
  const lebarMinimum = LEBAR_SISWA + data.jumlahHari * 28 + 4 * 34;

  return (
    <div data-uji="geser-matriks" className="w-full overflow-x-auto">
      <table className="border-collapse text-[12px]" style={{ minWidth: lebarMinimum }}>
        <thead>
          <tr>
            <th
              className="sticky left-0 z-20 border-b border-border bg-surface-2 px-3 py-2 text-left text-[11px] font-bold tracking-wider text-muted-foreground uppercase"
              style={{ minWidth: LEBAR_SISWA }}
            >
              Siswa
            </th>
            {hari.map((h) => {
              const libur = hariLibur.get(h);
              return (
                <th
                  key={h}
                  title={libur ?? (efektif.has(h) ? undefined : 'Bukan hari sekolah')}
                  className={cn(
                    'num w-7 min-w-7 border-b border-border bg-surface-2 py-2 text-center text-[10.5px] font-bold',
                    efektif.has(h) ? 'text-muted-foreground' : 'text-faint',
                  )}
                >
                  {h}
                </th>
              );
            })}
            <th className="border-b border-border bg-surface-2 px-2 py-2 text-center text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              H
            </th>
            <th className="border-b border-border bg-surface-2 px-2 py-2 text-center text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              T
            </th>
            <th className="border-b border-border bg-surface-2 px-2 py-2 text-center text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              A
            </th>
            <th className="border-b border-border bg-surface-2 px-2 py-2 text-center text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              %
            </th>
          </tr>
        </thead>

        <tbody>
          {data.baris.map((b) => (
            <tr key={b.siswaId} className="group">
              <td
                data-uji="kolom-nama"
                className="sticky left-0 z-10 border-b border-border bg-card px-3 py-1.5 group-hover:bg-surface-2"
                style={{ minWidth: LEBAR_SISWA }}
              >
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{b.nama}</div>
                    <div className="num truncate text-[11px] text-muted-foreground">{b.nis}</div>
                  </div>

                  {/*
                    Rekap per siswa diambil dari barisnya sendiri, bukan dari
                    tab terpisah yang mengharuskan mencari ulang nama yang
                    barusan dilihat di matriks ini.

                    Dua keputusan tampilan di sini, keduanya disengaja:

                     - Tombolnya ikut di dalam kolom sticky, supaya tetap
                       terjangkau saat matriks digeser ke tanggal 25 — di situlah
                       justru orang memutuskan rekap siapa yang perlu dicetak.
                     - Tombolnya TIDAK disembunyikan sampai barisnya di-hover.
                       Sejak tab "Per Siswa" dibuang, ini satu-satunya jalan ke
                       rekap per siswa; kalau baru muncul saat disentuh, orang
                       yang belum tahu tidak akan pernah menemukannya. Warnanya
                       dibuat redup supaya tidak berebut perhatian dengan data.
                  */}
                  <div data-uji="aksi-siswa" className="flex shrink-0 items-center gap-1">
                    <a
                      href={unduhan.bulananSiswaPdf(bulan, b.siswaId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Lihat & cetak rekap ${b.nama}`}
                      aria-label={`Lihat dan cetak rekap bulanan ${b.nama}`}
                      className="grid size-6 place-items-center rounded-md border border-border bg-surface-2 text-muted-foreground hover:bg-primary-soft hover:text-primary"
                    >
                      <PrinterIcon className="size-3.5" />
                    </a>
                    <a
                      href={unduhan.bulananSiswaExcel(bulan, b.siswaId)}
                      download
                      title={`Unduh Excel rekap ${b.nama}`}
                      aria-label={`Unduh Excel rekap bulanan ${b.nama}`}
                      className="grid size-6 place-items-center rounded-md border border-border bg-surface-2 text-muted-foreground hover:bg-primary-soft hover:text-primary"
                    >
                      <DownloadIcon className="size-3.5" />
                    </a>
                  </div>
                </div>
              </td>

              {b.sel.map((s) => {
                const g = GAYA[s.kode];
                /*
                 * Hari yang siswanya benar-benar scan menampilkan JAM, bukan
                 * cuma huruf status: "H" saja tidak memberi tahu dia datang
                 * pukul berapa atau sudah pulang atau belum. Warna selnya tetap
                 * membawa statusnya, jadi pola sebulan masih terbaca sekilas.
                 *
                 * Status tanpa jam (izin, sakit, alpa, libur) tetap huruf —
                 * memang tidak ada jam yang bisa ditampilkan.
                 */
                const punyaJam = s.jamMasuk || s.jamPulang;
                return (
                  <td
                    key={s.tanggal}
                    title={`${s.tanggal}: ${hariLibur.get(s.tanggal) ?? g.judul}${
                      punyaJam ? ` · masuk ${s.jamMasuk ?? '—'} · pulang ${s.jamPulang ?? '—'}` : ''
                    }`}
                    className={cn(
                      'num border-b border-border text-center font-bold',
                      punyaJam ? 'min-w-12 px-1 py-1 leading-tight' : 'min-w-7 py-1.5',
                      g.kelas,
                    )}
                  >
                    {punyaJam ? (
                      <div className="flex flex-col text-[10px]">
                        <span>{s.jamMasuk ?? '—'}</span>
                        <span className="border-t border-current/25 opacity-70">
                          {s.jamPulang ?? '—'}
                        </span>
                      </div>
                    ) : s.kode === '-' ? (
                      '·'
                    ) : (
                      s.kode
                    )}
                  </td>
                );
              })}

              <td className="num border-b border-border px-2 py-1.5 text-center font-bold text-hadir">
                {b.hadir ?? 0}
              </td>
              <td className="num border-b border-border px-2 py-1.5 text-center font-bold text-terlambat">
                {b.terlambat ?? 0}
              </td>
              <td className="num border-b border-border px-2 py-1.5 text-center font-bold text-alpa">
                {b.alpa ?? 0}
              </td>
              <td
                className={cn(
                  'num border-b border-border px-2 py-1.5 text-center font-bold',
                  (b.persenHadir ?? 100) < 85 && 'text-alpa',
                )}
              >
                {b.persenHadir === null || b.persenHadir === undefined ? '—' : b.persenHadir}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LegendaMatriks({ legenda }: { legenda: Record<string, string> }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 px-4 py-3 text-[11px] text-muted-foreground">
      {Object.entries(legenda).map(([kode, arti]) => (
        <span key={kode} className="flex items-center gap-1.5">
          <span
            className={cn(
              'num grid size-4 place-items-center rounded-[3px] text-[9px] font-bold',
              GAYA[kode as KodeSel]?.kelas ?? '',
            )}
          >
            {kode === '-' ? '·' : kode}
          </span>
          {arti}
        </span>
      ))}
    </div>
  );
}
