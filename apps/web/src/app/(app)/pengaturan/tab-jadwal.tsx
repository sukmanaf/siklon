'use client';

import { useEffect, useState } from 'react';
import { Loader2Icon, PlusIcon, Trash2Icon } from 'lucide-react';
import type { Presensi } from '@siklon/shared';
import { NAMA_HARI } from '@siklon/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardHint, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrap } from '@/components/ui/table';
import { useSimpanSetting } from '@/hooks/use-pengaturan';
import { selisihMenit, tambahMenit } from '@/lib/tanggal';
import { toastGagal, toastSukses } from '@/lib/toast';
import { cn } from '@/lib/utils';

const HARI_PENDEK = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/** Jam contoh untuk tabel "seperti apa aturannya nanti berlaku". */
const CONTOH = ['06:55', '07:08', '07:11', '07:22', '09:30'];

export function TabJadwal({ awal }: { awal: Presensi }) {
  const simpan = useSimpanSetting();
  const [nilai, setNilai] = useState<Presensi>(awal);

  // Nilai dari server bisa datang belakangan (atau berubah setelah disimpan).
  useEffect(() => setNilai(awal), [awal]);

  const batasTerlambat = tambahMenit(nilai.jam_masuk, nilai.toleransi_menit);
  const valid = batasTerlambat !== null && /^([01]\d|2[0-3]):[0-5]\d$/.test(nilai.batas_alpa);

  function ubah<K extends keyof Presensi>(k: K, v: Presensi[K]) {
    setNilai((n) => ({ ...n, [k]: v }));
  }

  function toggleHari(dow: number) {
    const ada = nilai.hari_sekolah.includes(dow);
    const baru = ada
      ? nilai.hari_sekolah.filter((d) => d !== dow)
      : [...nilai.hari_sekolah, dow].sort();
    // Minimal satu hari sekolah — tanpa itu tidak ada scan yang pernah diterima.
    if (baru.length === 0) return;
    ubah('hari_sekolah', baru);
  }

  function statusContoh(jam: string): 'HADIR' | 'TERLAMBAT' | 'ALPA' {
    if (!batasTerlambat) return 'HADIR';
    if (selisihMenit(jam, nilai.batas_alpa) <= 0) return 'ALPA';
    return selisihMenit(batasTerlambat, jam) > 0 ? 'TERLAMBAT' : 'HADIR';
  }

  const hariKhusus = Object.entries(nilai.khusus ?? {});

  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Jam Masuk &amp; Batas Terlambat</CardTitle>
          <CardHint>scan setelah batas ini otomatis dihitung TERLAMBAT</CardHint>
          <Button
            size="sm"
            variant="default"
            className="ml-auto"
            disabled={!valid || simpan.isPending}
            onClick={() =>
              simpan.mutate(
                { kunci: 'presensi', nilai },
                {
                  onSuccess: () => toastSukses('Aturan presensi disimpan'),
                  onError: (e) => toastGagal(e, 'Aturan gagal disimpan'),
                },
              )
            }
          >
            {simpan.isPending && <Loader2Icon className="animate-spin" />}
            Simpan
          </Button>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Inti FE-021: batas terlambat dihitung langsung saat angkanya diubah. */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="jam-masuk">Jam masuk</Label>
              <Input
                id="jam-masuk"
                type="time"
                value={nilai.jam_masuk}
                onChange={(e) => ubah('jam_masuk', e.target.value)}
                className="num w-[120px] text-[15px]"
              />
            </div>

            <div className="pb-2 text-xl text-faint">+</div>

            <div className="space-y-1.5">
              <Label htmlFor="toleransi">Toleransi</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="toleransi"
                  type="number"
                  min={0}
                  max={120}
                  value={nilai.toleransi_menit}
                  onChange={(e) =>
                    ubah('toleransi_menit', Math.max(0, Math.min(120, Number(e.target.value) || 0)))
                  }
                  className="num w-[72px] text-[15px]"
                />
                <span className="text-[13px] text-muted-foreground">menit</span>
              </div>
            </div>

            <div className="pb-2 text-xl text-faint">=</div>

            <div className="rounded-xl border border-terlambat bg-terlambat-bg px-4 py-2">
              <div className="text-[11px] font-bold tracking-wide text-terlambat uppercase">
                Batas terlambat
              </div>
              <div className="num text-[22px] font-bold text-terlambat">
                {batasTerlambat ?? '—'}
              </div>
            </div>
          </div>

          <div className="h-px bg-border" />

          <div className="flex flex-wrap gap-6">
            <div className="space-y-1.5">
              <Label htmlFor="batas-alpa">Batas alpa</Label>
              <Input
                id="batas-alpa"
                type="time"
                value={nilai.batas_alpa}
                onChange={(e) => ubah('batas_alpa', e.target.value)}
                className="num w-[120px]"
              />
              <p className="max-w-48 text-[11.5px] leading-relaxed text-muted-foreground">
                Belum scan sampai jam ini → <b>ALPA</b> dan wali dikabari.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="jam-pulang">Jam pulang</Label>
              <Input
                id="jam-pulang"
                type="time"
                value={nilai.jam_pulang}
                onChange={(e) => ubah('jam_pulang', e.target.value)}
                className="num w-[120px]"
              />
              <p className="max-w-48 text-[11.5px] leading-relaxed text-muted-foreground">
                Scan lagi pada/sesudah jam ini → dicatat sebagai <b>jam pulang</b>.
                Sebelum jam ini, scan kedua diabaikan sebagai kartu tertempel dua kali.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Hari sekolah</Label>
              <div className="flex flex-wrap gap-1.5">
                {HARI_PENDEK.map((h, dow) => {
                  const aktif = nilai.hari_sekolah.includes(dow);
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => toggleHari(dow)}
                      aria-pressed={aktif}
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
                        aktif
                          ? 'bg-primary-soft text-primary-ink'
                          : 'bg-libur-bg text-libur hover:text-foreground',
                      )}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                Di luar hari ini scan ditolak dan tidak dihitung.
              </p>
            </div>
          </div>

          <div className="h-px bg-border" />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <b className="text-[13px]">Pengecualian per hari</b>
              <TambahKhusus
                dipakai={hariKhusus.map(([d]) => Number(d))}
                onTambah={(dow) =>
                  ubah('khusus', { ...(nilai.khusus ?? {}), [String(dow)]: {} })
                }
              />
            </div>

            {hariKhusus.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">
                Belum ada. Dipakai bila satu hari punya jam masuk berbeda — misalnya Jumat masuk
                lebih siang.
              </p>
            ) : (
              <div className="space-y-2">
                {hariKhusus.map(([dow, o]) => (
                  <div
                    key={dow}
                    className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3"
                  >
                    <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary-ink">
                      {NAMA_HARI[Number(dow)]}
                    </span>

                    <div className="space-y-1">
                      <Label htmlFor={`k-jam-${dow}`}>Jam masuk</Label>
                      <Input
                        id={`k-jam-${dow}`}
                        type="time"
                        value={o?.jam_masuk ?? ''}
                        placeholder={nilai.jam_masuk}
                        onChange={(e) =>
                          ubah('khusus', {
                            ...nilai.khusus,
                            [dow]: { ...o, jam_masuk: e.target.value || undefined },
                          })
                        }
                        className="num w-[112px]"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor={`k-pulang-${dow}`}>Jam pulang</Label>
                      <Input
                        id={`k-pulang-${dow}`}
                        type="time"
                        value={o?.jam_pulang ?? ''}
                        placeholder={nilai.jam_pulang}
                        onChange={(e) =>
                          ubah('khusus', {
                            ...nilai.khusus,
                            [dow]: { ...o, jam_pulang: e.target.value || undefined },
                          })
                        }
                        className="num w-[112px]"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor={`k-tol-${dow}`}>Toleransi</Label>
                      <Input
                        id={`k-tol-${dow}`}
                        type="number"
                        min={0}
                        max={120}
                        value={o?.toleransi_menit ?? ''}
                        placeholder={String(nilai.toleransi_menit)}
                        onChange={(e) =>
                          ubah('khusus', {
                            ...nilai.khusus,
                            [dow]: {
                              ...o,
                              toleransi_menit:
                                e.target.value === '' ? undefined : Number(e.target.value),
                            },
                          })
                        }
                        className="num w-[80px]"
                      />
                    </div>

                    <Button
                      size="icon-sm"
                      variant="destructive-outline"
                      aria-label={`Hapus pengecualian ${NAMA_HARI[Number(dow)]}`}
                      onClick={() => {
                        const sisa = { ...nilai.khusus };
                        delete sisa[dow];
                        ubah('khusus', sisa);
                      }}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                ))}
                <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                  Kolom yang dikosongkan ikut nilai utama di atas — hanya yang diisi yang menimpa.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="self-start">
        <CardHeader>
          <CardTitle>Contoh penerapan</CardTitle>
          <CardHint>ikut berubah saat angkanya diubah</CardHint>
        </CardHeader>
        <TableWrap>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jam scan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Keterangan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CONTOH.map((jam) => {
                const st = statusContoh(jam);
                const lewat = batasTerlambat ? selisihMenit(batasTerlambat, jam) : 0;
                return (
                  <TableRow key={jam}>
                    <TableCell className="num">{jam}</TableCell>
                    <TableCell>
                      <StatusBadge status={st} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {st === 'ALPA'
                        ? `lewat batas alpa ${nilai.batas_alpa}`
                        : st === 'TERLAMBAT'
                          ? `lewat ${lewat} menit dari batas ${batasTerlambat}`
                          : selisihMenit(nilai.jam_masuk, jam) > 0
                            ? `masih dalam toleransi ${nilai.toleransi_menit} menit`
                            : 'sebelum jam masuk'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableWrap>
        <CardContent>
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            Menit keterlambatan dihitung dari <b>batas</b> ({batasTerlambat ?? '—'}), bukan dari
            jam masuk — kalau dihitung dari jam masuk, toleransi jadi tidak berarti di laporan.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function TambahKhusus({
  dipakai,
  onTambah,
}: {
  dipakai: number[];
  onTambah: (dow: number) => void;
}) {
  const tersedia = [0, 1, 2, 3, 4, 5, 6].filter((d) => !dipakai.includes(d));
  if (tersedia.length === 0) return null;

  return (
    <Select value="" onValueChange={(v) => onTambah(Number(v))}>
      <SelectTrigger className="h-7 w-36 text-xs" aria-label="Tambah pengecualian hari">
        <span className="flex items-center gap-1.5">
          <PlusIcon className="size-3.5" /> Tambah
        </span>
      </SelectTrigger>
      <SelectContent>
        {tersedia.map((d) => (
          <SelectItem key={d} value={String(d)}>
            {NAMA_HARI[d]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
