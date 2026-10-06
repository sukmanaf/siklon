'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2Icon, PaperclipIcon, XIcon } from 'lucide-react';
import type { StatusPresensi } from '@siklon/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TrashIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/status-badge';
import { IdentitasSiswa } from '@/components/identitas-siswa';
import {
  lampiranUrl,
  useHapusLampiranPresensi, useHapusPresensi,
  useTandaiTanpaScan,
  useUbahStatusPresensi,
  useUnggahLampiranPresensi,
} from '@/hooks/use-laporan';
import type { BarisHarian } from '@/hooks/use-presensi';
import { pesanError } from '@/lib/api';
import { toastGagal, toastSukses } from '@/lib/toast';
import { cn } from '@/lib/utils';

/** Alasan yang paling sering ditulis; mengetik ulang tiap hari itu melelahkan. */
const ALASAN = {
  HADIR: ['Lupa bawa kartu', 'Kartu hilang', 'Kesalahan sistem'],
  TERLAMBAT: ['Lupa bawa kartu', 'Kartu hilang', 'Macet di jalan'],
  IZIN: ['Surat izin dari orang tua', 'Keperluan keluarga', 'Kegiatan sekolah'],
  SAKIT: ['Surat keterangan sakit', 'Sakit, dikabari orang tua'],
  ALPA: ['Tanpa keterangan', 'Tidak hadir tanpa kabar'],
};

/**
 * Ubah status presensi satu siswa (FE-037).
 *
 * Catatan **wajib** — itu aturan server, dan alasannya kuat: koreksi status
 * tanpa alasan tertulis tidak bisa dipertanggungjawabkan saat orang tua
 * bertanya kenapa anaknya tercatat alpa.
 *
 * Dua jalur berbeda tergantung apakah siswa sudah punya baris presensi:
 * yang sudah ada di-PATCH, yang belum ditandai lewat /attendance/tandai.
 */

function handleUbahWaktu(value: string, setter: (val: string) => void) {
  let v = value.replace(/[^\d]/g, '');
  if (v.length > 4) v = v.substring(0, 4);
  
  if (v.length >= 2) {
    const h = parseInt(v.substring(0, 2));
    if (h > 23) v = '23' + v.substring(2);
  }
  if (v.length >= 4) {
    const m = parseInt(v.substring(2, 4));
    if (m > 59) v = v.substring(0, 2) + '59';
  }
  if (v.length >= 3) {
    v = v.substring(0, 2) + ':' + v.substring(2);
  }
  setter(v);
}

export function DialogUbahStatus({
  baris,
  tanggal,
  onTutup,
}: {
  baris: BarisHarian | null;
  tanggal: string;
  onTutup: () => void;
}) {
  const ubah = useUbahStatusPresensi();
  const tandai = useTandaiTanpaScan();
  const unggahLampiran = useUnggahLampiranPresensi();
  const hapusLampiran = useHapusLampiranPresensi();
  const hapusPresensi = useHapusPresensi();
  const [status, setStatus] = useState<StatusPresensi>('IZIN');
  const [catatan, setCatatan] = useState('');
  const [jamMasuk, setJamMasuk] = useState('');
  const [jamPulang, setJamPulang] = useState('');
  /** Berkas yang baru dipilih tapi belum diunggah — diunggah setelah status tersimpan. */
  const [berkasBaru, setBerkasBaru] = useState<File | null>(null);
  const [pratinjauBaru, setPratinjauBaru] = useState<string | null>(null);
  /** Punya lampiran dari sebelumnya, ikut diperbarui begitu diganti/dihapus. */
  const [punyaLampiranLama, setPunyaLampiranLama] = useState(false);
  const inputBerkasRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!baris) return;
    setStatus(baris.status === 'BELUM' ? 'IZIN' : (baris.status as StatusPresensi));
    setCatatan(baris.catatan ?? '');
    setJamMasuk(baris.jamMasuk ? baris.jamMasuk.substring(0, 5) : '');
    setJamPulang(baris.jamPulang ? baris.jamPulang.substring(0, 5) : '');
    setBerkasBaru(null);
    setPratinjauBaru(null);
    setPunyaLampiranLama(baris.punyaLampiran);
  }, [baris]);

  // Pratinjau berkas baru pakai object URL — harus dilepas lagi supaya tidak bocor memori.
  useEffect(() => {
    if (!berkasBaru) {
      setPratinjauBaru(null);
      return;
    }
    const url = URL.createObjectURL(berkasBaru);
    setPratinjauBaru(url);
    return () => URL.revokeObjectURL(url);
  }, [berkasBaru]);

  const punyaBaris = Boolean(baris?.presensiId);
  // Tanpa baris presensi, server hanya menerima IZIN/SAKIT/ALPA.
  const pilihan: StatusPresensi[] = ['HADIR', 'TERLAMBAT', 'IZIN', 'SAKIT', 'ALPA'];
  // Lampiran cuma masuk akal untuk absen yang butuh bukti tertulis.
  const bolehLampirkan = status === 'IZIN' || status === 'SAKIT';

  const sedang = ubah.isPending || tandai.isPending || unggahLampiran.isPending;
  const error = ubah.error ?? tandai.error ?? unggahLampiran.error;
  const bolehSimpan = catatan.trim().length > 0 && !sedang;

  function simpan() {
    if (!baris || !catatan.trim()) return;
    const opsi = {
      onSuccess: (hasil: { id: string }) => {
        const presensiId = baris.presensiId ?? hasil.id;
        if (berkasBaru && presensiId) {
          unggahLampiran.mutate(
            { presensiId, berkas: berkasBaru },
            {
              onSuccess: () => {
                toastSukses(`${baris.nama} sekarang ${status}`);
                onTutup();
              },
              onError: (e: unknown) =>
                toastGagal(e, 'Status tersimpan, tapi lampiran gagal diunggah'),
            },
          );
        } else {
          toastSukses(`${baris.nama} sekarang ${status}`);
          onTutup();
        }
      },
      onError: (e: unknown) => toastGagal(e, 'Status gagal diubah'),
    };

    if (baris.presensiId) {
      ubah.mutate({ presensiId: baris.presensiId, status, catatan: catatan.trim(), jamMasuk: jamMasuk || undefined, jamPulang: jamPulang || undefined }, opsi);
    } else {
      tandai.mutate(
        {
          siswaId: baris.siswaId,
          tanggal,
          status: status as any,
          catatan: catatan.trim(),
          jamMasuk: jamMasuk || undefined,
          jamPulang: jamPulang || undefined,
        },
        opsi,
      );
    }
  }

  return (
    <Dialog open={Boolean(baris)} onOpenChange={(o) => !o && onTutup()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ubah status presensi</DialogTitle>
          <DialogDescription>
            Perubahan ini tercatat sebagai koreksi manual beserta alasannya, dan ikut terlihat di
            laporan bulanan.
          </DialogDescription>
        </DialogHeader>

        {baris && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              <IdentitasSiswa nama={baris.nama} nis={baris.nis} kelas={baris.kelas} />
              <div className="ml-auto">
                {baris.status === 'BELUM' ? (
                  <span className="text-xs text-faint">belum tercatat</span>
                ) : (
                  <StatusBadge status={baris.status} />
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Status baru</Label>
              <div className="flex flex-wrap gap-1.5">
                {pilihan.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    aria-pressed={status === s}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors',
                      status === s
                        ? 'bg-primary text-white'
                        : 'bg-surface-2 text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>

            </div>

            {(status === 'HADIR' || status === 'TERLAMBAT') && (
              <div className="flex gap-4">
                <div className="space-y-1.5 flex-1">
                  <Label htmlFor="jamMasuk">Jam Masuk (opsional)</Label>
                  <input
                    type="text"
                    id="jamMasuk"
                    placeholder="00:00"
                    maxLength={5}
                    value={jamMasuk}
                    onChange={(e) => handleUbahWaktu(e.target.value, setJamMasuk)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <div className="space-y-1.5 flex-1">
                  <Label htmlFor="jamPulang">Jam Pulang (opsional)</Label>
                  <input
                    type="text"
                    id="jamPulang"
                    placeholder="00:00"
                    maxLength={5}
                    value={jamPulang}
                    onChange={(e) => handleUbahWaktu(e.target.value, setJamPulang)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="catatan-status">
                Alasan<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {(ALASAN[status as keyof typeof ALASAN] ?? []).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setCatatan(a)}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors',
                      catatan === a
                        ? 'bg-primary text-white'
                        : 'bg-surface-2 text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <Textarea
                id="catatan-status"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Kenapa statusnya diubah?"
                className="min-h-16"
              />
              {catatan.trim().length === 0 && (
                <p className="text-[11.5px] font-medium text-destructive">
                  Alasan wajib diisi — server menolak perubahan tanpa catatan.
                </p>
              )}
            </div>

            {bolehLampirkan && (
              <div className="space-y-1.5">
                <Label>Lampiran (opsional)</Label>
                <input
                  ref={inputBerkasRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => setBerkasBaru(e.target.files?.[0] ?? null)}
                />

                {pratinjauBaru ? (
                  <div className="flex items-center gap-3 rounded-lg border border-border p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- pratinjau lokal (object URL), bukan aset Next.js */}
                    <img src={pratinjauBaru} alt="Pratinjau lampiran" className="h-16 w-16 rounded object-cover" />
                    <div className="min-w-0 flex-1 truncate text-[12.5px] text-muted-foreground">
                      {berkasBaru?.name}
                    </div>
                    <Button
                      size="sm"
                      type="button"
                      onClick={() => {
                        setBerkasBaru(null);
                        if (inputBerkasRef.current) inputBerkasRef.current.value = '';
                      }}
                    >
                      <XIcon />
                    </Button>
                  </div>
                ) : punyaLampiranLama && baris.presensiId ? (
                  <div className="flex items-center gap-3 rounded-lg border border-border p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- perlu cookie sesi, bukan aset Next.js */}
                    <img
                      src={lampiranUrl(baris.presensiId)}
                      alt="Lampiran tersimpan"
                      className="h-16 w-16 rounded object-cover"
                    />
                    <div className="flex-1 text-[12.5px] text-muted-foreground">Lampiran tersimpan</div>
                    <Button
                      size="sm"
                      type="button"
                      disabled={hapusLampiran.isPending}
                      onClick={() => {
                        if (!baris.presensiId) return;
                        hapusLampiran.mutate(baris.presensiId, {
                          onSuccess: () => setPunyaLampiranLama(false),
                          onError: (e) => toastGagal(e, 'Lampiran gagal dihapus'),
                        });
                      }}
                    >
                      {hapusLampiran.isPending ? <Loader2Icon className="animate-spin" /> : <XIcon />}
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    type="button"
                    onClick={() => inputBerkasRef.current?.click()}
                  >
                    <PaperclipIcon />
                    Lampirkan foto (JPG/PNG)
                  </Button>
                )}
              </div>
            )}

            {error !== null && (
              <p className="rounded-lg bg-alpa-bg px-3.5 py-2.5 text-[12.5px] font-medium text-alpa">
                {pesanError(error)}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          
          {baris?.presensiId && (
            <Button
              type="button"
              variant="destructive"
              disabled={hapusPresensi.isPending}
              onClick={() => {
                if (confirm('Yakin ingin menghapus presensi ini?')) {
                  hapusPresensi.mutate(baris.presensiId!, {
                    onSuccess: () => {
                      toastSukses('Presensi dihapus');
                      onTutup();
                    },
                    onError: (e) => toastGagal(e, 'Gagal menghapus'),
                  });
                }
              }}
            >
              {hapusPresensi.isPending ? <Loader2Icon className="animate-spin" /> : <TrashIcon />}
              Hapus
            </Button>
          )}

          <Button onClick={onTutup} disabled={sedang}>
            Batal
          </Button>
          <Button variant="default" disabled={!bolehSimpan} onClick={simpan}>
            {sedang && <Loader2Icon className="animate-spin" />}
            Simpan perubahan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
