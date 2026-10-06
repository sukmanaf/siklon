'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileSpreadsheetIcon,
  Loader2Icon,
  TriangleAlertIcon,
  UploadIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardContentFlush, CardHeader, CardHint, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrap } from '@/components/ui/table';
import { useImportSiswa } from '@/hooks/use-siswa';
import { useDaftarKelas } from '@/hooks/use-kelas';
import { PeringatanGagal } from '@/components/peringatan-gagal';
import { URL_API, pesanError } from '@/lib/api';
import { toastGagal, toastSukses } from '@/lib/toast';
import type { HasilImport } from '@/lib/tipe';

export default function HalamanImport() {
  const impor = useImportSiswa();
  const kelas = useDaftarKelas();
  const inputRef = useRef<HTMLInputElement>(null);

  const [berkas, setBerkas] = useState<File | null>(null);
  const [hasil, setHasil] = useState<HasilImport | null>(null);
  const [sudahDiperiksa, setSudahDiperiksa] = useState(false);

  function pilih(f: File | undefined) {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.xlsx')) {
      toastGagal(new Error('Hanya berkas .xlsx yang didukung.'), 'Jenis berkas salah');
      return;
    }
    setBerkas(f);
    setHasil(null);
    setSudahDiperiksa(false);
  }

  function jalankan(hanyaPeriksa: boolean) {
    if (!berkas) return;
    impor.mutate(
      { berkas, hanyaPeriksa },
      {
        onSuccess: (h) => {
          setHasil(h);
          setSudahDiperiksa(true);
          if (h.tersimpan) toastSukses('Import selesai', h.pesan);
        },
        onError: (e) => {
          setHasil(null);
          toastGagal(e, 'Berkas tidak bisa dibaca');
        },
      },
    );
  }

  const bersih = hasil !== null && hasil.jumlahMasalah === 0;
  const bolehSimpan = bersih && !hasil.tersimpan;

  return (
    <div className="space-y-4">
      <Button size="sm" variant="ghost" asChild className="-ml-2">
        <Link href="/siswa">
          <ArrowLeftIcon />
          Kembali ke daftar siswa
        </Link>
      </Button>

      {kelas.isError && (
        <PeringatanGagal
          judul="Daftar kelas gagal dimuat."
          error={kelas.error}
          onCobaLagi={() => void kelas.refetch()}
        />
      )}

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Import Siswa dari Excel</CardTitle>
              <CardHint>periksa dulu, simpan kemudian</CardHint>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => pilih(e.target.files?.[0])}
              />

              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="grid w-full place-items-center gap-2 rounded-xl border border-dashed border-border bg-surface-2 py-10 text-center transition-colors hover:border-primary"
              >
                <FileSpreadsheetIcon className="size-7 text-faint" />
                {berkas ? (
                  <>
                    <span className="text-[13px] font-semibold">{berkas.name}</span>
                    <span className="text-[11.5px] text-muted-foreground">
                      {(berkas.size / 1024).toFixed(0)} KB · klik untuk ganti berkas
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[13px] font-semibold">Pilih berkas .xlsx</span>
                    <span className="text-[11.5px] text-muted-foreground">
                      Maksimal 10 MB — cukup untuk ribuan baris
                    </span>
                  </>
                )}
              </button>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="default"
                  disabled={!berkas || impor.isPending}
                  onClick={() => jalankan(true)}
                >
                  {impor.isPending && <Loader2Icon className="animate-spin" />}
                  Periksa berkas
                </Button>

                <Button
                  disabled={!bolehSimpan || impor.isPending}
                  onClick={() => jalankan(false)}
                  title={
                    bolehSimpan
                      ? undefined
                      : 'Periksa berkas dulu, dan pastikan tidak ada baris bermasalah'
                  }
                >
                  <UploadIcon />
                  Simpan ke database
                </Button>

                {berkas && (
                  <Button
                    variant="ghost"
                    disabled={impor.isPending}
                    onClick={() => {
                      setBerkas(null);
                      setHasil(null);
                      setSudahDiperiksa(false);
                      if (inputRef.current) inputRef.current.value = '';
                    }}
                  >
                    Bersihkan
                  </Button>
                )}
              </div>

              {impor.isError && (
                <p className="rounded-lg bg-alpa-bg px-3.5 py-2.5 text-[12.5px] font-medium text-alpa">
                  {pesanError(impor.error)}
                </p>
              )}
            </CardContent>
          </Card>

          {hasil && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {hasil.tersimpan
                    ? 'Hasil import'
                    : hasil.jumlahMasalah > 0
                      ? 'Ada baris bermasalah'
                      : 'Pemeriksaan lolos'}
                </CardTitle>
                <CardHint>
                  {hasil.totalBaris} baris terbaca · {hasil.jumlahMasalah} bermasalah
                </CardHint>
              </CardHeader>

              <CardContent className="space-y-3">
                <div
                  className={
                    hasil.jumlahMasalah > 0
                      ? 'flex items-start gap-2 rounded-lg bg-alpa-bg px-3.5 py-2.5 text-[12.5px] leading-relaxed text-alpa'
                      : 'flex items-start gap-2 rounded-lg bg-hadir-bg px-3.5 py-2.5 text-[12.5px] leading-relaxed text-hadir'
                  }
                >
                  {hasil.jumlahMasalah > 0 ? (
                    <TriangleAlertIcon className="mt-px size-4 shrink-0" />
                  ) : (
                    <CheckCircle2Icon className="mt-px size-4 shrink-0" />
                  )}
                  <span>{hasil.pesan}</span>
                </div>

                {hasil.tersimpan && (
                  <>
                    <dl className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
                      <div>
                        <dt className="text-xs text-muted-foreground">Siswa dibuat</dt>
                        <dd className="num text-lg font-bold text-hadir">{hasil.siswaDibuat}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Punya nomor wali</dt>
                        <dd className="num text-lg font-bold">{hasil.siswaDenganWali}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Belum ada nomor</dt>
                        <dd
                          className={`num text-lg font-bold ${
                            (hasil.siswaTanpaWali ?? 0) > 0 ? 'text-terlambat' : ''
                          }`}
                        >
                          {hasil.siswaTanpaWali}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Nomor berbeda</dt>
                        <dd className="num text-lg font-bold">{hasil.nomorWaliUnik}</dd>
                      </div>
                    </dl>
                    {(hasil.siswaTanpaWali ?? 0) > 0 && (
                      <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                        {hasil.siswaTanpaWali} siswa masuk tanpa nomor wali — kedatangan mereka
                        tidak akan dikabarkan ke siapa pun sampai nomornya diisi.
                      </p>
                    )}
                  </>
                )}

                {hasil.tersimpan && (
                  <Button variant="default" asChild>
                    <Link href="/siswa">Lihat daftar siswa</Link>
                  </Button>
                )}
              </CardContent>

              {hasil.masalah.length > 0 && (
                <CardContentFlush>
                  <TableWrap className="max-h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">Baris</TableHead>
                          <TableHead className="w-32">Kolom</TableHead>
                          <TableHead>Masalah</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {hasil.masalah.map((m, i) => (
                          <TableRow key={`${m.baris}-${m.kolom}-${i}`}>
                            <TableCell className="num font-semibold text-alpa">{m.baris}</TableCell>
                            <TableCell className="text-muted-foreground">{m.kolom}</TableCell>
                            <TableCell>{m.pesan}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableWrap>
                  {hasil.masalahDipotong && (
                    <p className="border-t border-border px-4 py-2 text-[12.5px] text-muted-foreground">
                      Hanya 100 masalah pertama yang ditampilkan. Perbaiki yang ini dulu, lalu
                      periksa ulang.
                    </p>
                  )}
                </CardContentFlush>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Template Excel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Unduh template yang sudah berisi baris judul yang benar dan satu sheet Petunjuk.
                Memakai template ini menghindarkan kesalahan nama kolom.
              </p>
              <Button asChild variant="default" className="w-full">
                {/* Unduhan berkas biner: biarkan browser yang menanganinya. */}
                <a href={`${URL_API}/students/template/excel`} download>
                  <DownloadIcon />
                  Unduh template
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Yang perlu disiapkan</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal space-y-2 pl-4 text-[13px] leading-relaxed text-muted-foreground">
                <li>
                  <b className="text-foreground">Kelas harus sudah ada.</b> Import menolak nama
                  kelas yang belum terdaftar — nama yang salah ketik akan melahirkan kelas hantu
                  kalau dibuat otomatis.{' '}
                  <Link href="/kelas" className="text-primary hover:underline">
                    Buka halaman Kelas
                  </Link>
                  {kelas.data ? ` (${kelas.data.length} kelas terdaftar).` : '.'}
                </li>
                <li>
                  <b className="text-foreground">NIS wajib dan unik.</b> NIS adalah isi QR di kartu
                  siswa; dua siswa dengan NIS sama berarti satu kartu bisa mengabsenkan orang yang
                  salah.
                </li>
                <li>
                  <b className="text-foreground">Nomor HP boleh ditulis bebas.</b> 0812-3456-7890
                  dan +62 812 3456 7890 disimpan sama. Kakak-adik memang menyimpan nomor yang
                  sama di dua baris — itu bukan data dobel.
                </li>
                <li>
                  <b className="text-foreground">Nomor HP wali boleh dikosongkan.</b> Siswanya
                  tetap tercatat presensinya, hanya walinya yang tidak dikabari. Nama wali tidak
                  perlu diisi sama sekali — pesan WhatsApp menyapa <b>Bpk/Ibu</b> lalu langsung
                  menyebut nama ananda.
                </li>
                <li>
                  <b className="text-foreground">Tidak ada yang tersimpan kalau ada error.</b>{' '}
                  Periksa dulu, perbaiki berkasnya, baru simpan.
                </li>
              </ol>
            </CardContent>
          </Card>

          {sudahDiperiksa && !bersih && (
            <div className="rounded-lg border border-border bg-card p-4 text-[12.5px] leading-relaxed text-muted-foreground shadow-card">
              Perbaiki baris yang disebutkan di sebelah kiri pada berkas Excel-nya, simpan, lalu
              pilih berkasnya lagi dan tekan <b>Periksa berkas</b>.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
