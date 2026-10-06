'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CameraIcon,
  Loader2Icon,
  PlugZapIcon,
  RadarIcon,
  SaveIcon,
  TriangleAlertIcon,
  UsbIcon,
} from 'lucide-react';
import type { Scanner } from '@siklon/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardContentFlush, CardHeader, CardHint, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrap,
} from '@/components/ui/table';
import { EmptyState } from '@/components/empty-state';
import { IndikatorSambungan } from '@/components/indikator-sambungan';
import { ModeKamera, PesanHalangan } from '@/components/mode-kamera';
import { useSetelanKamera } from '@/hooks/use-setelan-kamera';
import { useDaftarKamera } from '@/hooks/use-daftar-kamera';
import { useDaftarScanner, useModeIdentifikasi, useSimpanPemetaan } from '@/hooks/use-scanner';
import { useSocket } from '@/hooks/use-socket';
import { pesanError } from '@/lib/api';
import { toastGagal, toastSukses } from '@/lib/toast';
import { cn } from '@/lib/utils';

/** Satu baris yang sedang disunting di layar. */
type Draf = { kode: string; label: string; aktif: boolean };

export default function HalamanScanner() {
  const daftar = useDaftarScanner();
  const simpan = useSimpanPemetaan();
  const { mulai, hentikan } = useModeIdentifikasi();

  const { setelan: kamera, simpan: simpanKamera, setPerangkat } = useSetelanKamera();
  const daftarKamera = useDaftarKamera();
  const jumlahKameraDipakai = kamera.perangkatIds.length;

  /**
   * Menyalakan kamera untuk pertama kali langsung memakai SEMUA kamera yang
   * terdeteksi. Kalau defaultnya kosong, saklar induk menyala tapi tidak ada
   * satu pun kamera yang memindai — dan itu terlihat seperti kerusakan.
   */
  function nyalakanKamera(nyala: boolean) {
    if (nyala && kamera.perangkatIds.length === 0 && daftarKamera.kamera.length > 0) {
      simpanKamera({ aktif: true, perangkatIds: daftarKamera.kamera.map((k) => k.deviceId) });
      return;
    }
    simpanKamera({ aktif: nyala });
  }

  /** Halaman pengaturan sengaja tidak mencatat presensi. */
  const janganCatat = useCallback(() => undefined, []);

  /*
   * Setelan versi lama hanya menyimpan satu kamera, dan setelah dibaca ulang
   * bisa berakhir sebagai "aktif tapi tidak ada kamera terpilih". Kalau
   * dibiarkan, saklar induk tampak menyala padahal daftar kameranya kosong —
   * dua bagian layar yang saling bertentangan. Dibereskan begitu daftar
   * kameranya diketahui.
   */
  useEffect(() => {
    if (!kamera.aktif) return;
    if (kamera.perangkatIds.length > 0) return;
    if (daftarKamera.memuat || daftarKamera.kamera.length === 0) return;
    simpanKamera({ perangkatIds: daftarKamera.kamera.map((k) => k.deviceId) });
  }, [kamera.aktif, kamera.perangkatIds.length, daftarKamera.memuat, daftarKamera.kamera, simpanKamera]);
  const [draf, setDraf] = useState<Record<string, Draf>>({});
  const [disorot, setDisorot] = useState<string | null>(null);
  const [sisaDetik, setSisaDetik] = useState(0);
  const inputRef = useRef<Record<string, HTMLInputElement | null>>({});

  // Nilai dari server jadi titik awal suntingan; yang sudah diketik operator
  // tidak ditimpa saat daftar disegarkan tiap 15 detik.
  useEffect(() => {
    if (!daftar.data) return;
    setDraf((lama) => {
      const baru = { ...lama };
      for (const p of daftar.data.terdeteksi) {
        if (!(p.kunci in baru)) {
          baru[p.kunci] = {
            kode: p.kode ?? '',
            label: p.label ?? '',
            // Port yang belum pernah dipetakan default AKTIF. Kalau default-nya
            // mati, operator yang lupa menyalakan saklarnya akan mengira
            // pemetaannya sudah beres padahal agent tidak pernah membuka port
            // itu — dan tidak ada satu pun scan yang masuk.
            aktif: p.sudahDinamai ? p.aktif : true,
          };
        }
      }
      for (const s of daftar.data.tidakTerdeteksi) {
        if (!(s.id in baru)) baru[s.id] = { kode: s.kode, label: s.label, aktif: s.aktif };
      }
      return baru;
    });
  }, [daftar.data]);

  /**
   * Inti FE-032: saat mode identifikasi aktif dan sebuah scanner ditempeli
   * barcode, server menyiarkan port mana yang barusan dipakai. Barisnya
   * disorot dan kursor langsung melompat ke kolom kodenya — operator tinggal
   * mengetik nama gerbangnya tanpa menebak-nebak baris mana yang benar.
   */
  const onIdentify = useCallback(
    (data: { portPath: string; kode: string | null }) => {
      const cocok = daftar.data?.terdeteksi.find((p) => p.path === data.portPath);
      const kunci = cocok?.kunci ?? data.portPath;
      setDisorot(kunci);
      // Segarkan daftar: port ini mungkin baru muncul.
      void daftar.refetch();
      setTimeout(() => {
        const el = inputRef.current[kunci];
        el?.focus();
        el?.select();
      }, 60);
    },
    [daftar],
  );

  const { status, percobaan, alasan } = useSocket({ onIdentify });

  // Hitung mundur mode identifikasi (server memberi 60 detik).
  useEffect(() => {
    if (sisaDetik <= 0) return;
    const t = setTimeout(() => setSisaDetik((d) => d - 1), 1000);
    return () => clearTimeout(t);
  }, [sisaDetik]);

  const modeAktif = daftar.data?.modeIdentifikasi || sisaDetik > 0;

  const berubah = useMemo(() => {
    if (!daftar.data) return false;
    const awal = new Map<string, Draf>();
    for (const p of daftar.data.terdeteksi) {
      awal.set(p.kunci, { kode: p.kode ?? '', label: p.label ?? '', aktif: p.aktif });
    }
    for (const s of daftar.data.tidakTerdeteksi) {
      awal.set(s.id, { kode: s.kode, label: s.label, aktif: s.aktif });
    }
    return [...Object.entries(draf)].some(([k, d]) => {
      const a = awal.get(k);
      if (!a) return d.kode.trim() !== '' || d.label.trim() !== '';
      return a.kode !== d.kode || a.label !== d.label || a.aktif !== d.aktif;
    });
  }, [draf, daftar.data]);

  function simpanSemua() {
    // Hanya baris yang punya kode DAN label yang dikirim; yang kosong berarti
    // belum diberi nama dan memang tidak perlu disimpan.
    const scanners: Scanner[] = Object.entries(draf)
      .filter(([, d]) => d.kode.trim() && d.label.trim())
      .map(([id, d]) => ({
        id,
        tipe: 'SERIAL' as const,
        kode: d.kode.trim().toUpperCase(),
        label: d.label.trim(),
        aktif: d.aktif,
      }));

    simpan.mutate(scanners, {
      onSuccess: () =>
        toastSukses(
          `${scanners.length} titik scan disimpan`,
          'Scanner Agent langsung menerapkannya tanpa perlu restart.',
        ),
      onError: (e) => toastGagal(e, 'Pemetaan gagal disimpan'),
    });
  }

  const ubah = (kunci: string, patch: Partial<Draf>) =>
    setDraf((d) => ({ ...d, [kunci]: { ...(d[kunci] ?? { kode: '', label: '', aktif: true }), ...patch } }));

  if (daftar.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (daftar.isError) {
    return (
      <Card>
        <EmptyState
          variant="error"
          judul="Daftar scanner tidak bisa dimuat"
          deskripsi={pesanError(daftar.error)}
          aksi={
            <Button variant="default" onClick={() => void daftar.refetch()}>
              Coba lagi
            </Button>
          }
        />
      </Card>
    );
  }

  const d = daftar.data;
  const belumDinamai = d.terdeteksi.filter((p) => !draf[p.kunci]?.kode?.trim()).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <IndikatorSambungan status={status} percobaan={percobaan} alasan={alasan} />
        <Badge variant={d.agent.online ? 'ok' : 'danger'}>
          Scanner Agent {d.agent.online ? 'online' : 'offline'}
        </Badge>
        {d.agent.versi && <Badge variant="muted">v{d.agent.versi}</Badge>}
        {belumDinamai > 0 && (
          <Badge variant="warn">{belumDinamai} port belum diberi nama</Badge>
        )}
      </div>

      {!d.agent.online && (
        <div className="flex items-start gap-3 rounded-lg border border-alpa bg-alpa-bg px-4 py-3 text-[12.5px] leading-relaxed text-alpa">
          <PlugZapIcon className="mt-px size-4 shrink-0" />
          <span>
            <b>Scanner Agent belum melapor.</b> Daftar port hanya bisa muncul kalau agent di PC
            gerbang sedang berjalan. Jalankan servisnya lebih dulu, lalu segarkan halaman ini.
          </span>
        </div>
      )}

      {/*
        Kamera dan pemindai serial diatur di halaman yang sama karena keduanya
        diperlakukan sama: sama-sama menghasilkan presensi sungguhan, dan
        sistem ini tidak membedakan siswa absen lewat yang mana.
      */}
      <Card>
        <CardHeader>
          <CardTitle>Kamera Perangkat Ini</CardTitle>
          <CardHint>boleh lebih dari satu menyala bersamaan</CardHint>
          <div className="ml-auto flex items-center gap-2.5">
            <Label htmlFor="kamera-aktif" className="text-[13px] text-foreground">
              {kamera.aktif ? 'Nyala' : 'Mati'}
            </Label>
            <Switch
              id="kamera-aktif"
              checked={kamera.aktif}
              onCheckedChange={(v) => nyalakanKamera(v)}
              aria-label="Nyalakan kamera untuk memindai"
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {!kamera.aktif ? (
            <div className="flex items-start gap-2 rounded-lg bg-surface-2 p-3 text-[12.5px] leading-relaxed text-muted-foreground">
              <CameraIcon className="mt-px size-4 shrink-0" />
              <span>
                Nyalakan bila layar Konsol Scan di perangkat ini dipakai memindai lewat kamera.
                Setelan ini <b>khusus perangkat ini</b> — PC gerbang, laptop TU, dan HP
                masing-masing punya pilihannya sendiri.
              </span>
            </div>
          ) : daftarKamera.memuat ? (
            <Skeleton className="h-40 w-full max-w-md" />
          ) : daftarKamera.halangan ? (
            <div className="rounded-xl border border-border bg-surface-2 p-4">
              <PesanHalangan
                halangan={daftarKamera.halangan}
                onCobaLagi={() => void daftarKamera.muatUlang()}
              />
            </div>
          ) : (
            <>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                Nyalakan setiap kamera yang dipakai memindai — semuanya bekerja bersamaan, dan
                kartu yang terbaca di kamera mana pun tercatat sebagai presensi yang sama.
                Di sini hanya pratinjau: QR di depan kamera <b>tidak</b> dicatat dari halaman ini.
              </p>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {daftarKamera.kamera.map((k, i) => {
                  const dipakai = kamera.perangkatIds.includes(k.deviceId);
                  return (
                    <div
                      key={k.deviceId}
                      data-uji="kartu-kamera"
                      className={cn(
                        'space-y-2 rounded-xl border p-2.5 transition-colors',
                        dipakai ? 'border-primary bg-primary-soft' : 'border-border bg-surface-2',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`kamera-${k.deviceId}`}
                          checked={dipakai}
                          onCheckedChange={(v) => setPerangkat(k.deviceId, v)}
                          aria-label={`Pakai ${k.label || `Kamera ${i + 1}`} untuk memindai`}
                        />
                        <Label
                          htmlFor={`kamera-${k.deviceId}`}
                          className="min-w-0 flex-1 truncate text-[12.5px] text-foreground"
                          title={k.label || `Kamera ${i + 1}`}
                        >
                          {k.label || `Kamera ${i + 1}`}
                        </Label>
                      </div>

                      {/* Pratinjau hanya untuk kamera yang dipakai — membuka
                          semua kamera sekaligus di halaman pengaturan
                          membebani perangkat tanpa ada gunanya. */}
                      {dipakai ? (
                        <ModeKamera aktif perangkatId={k.deviceId} onKode={janganCatat} pindai={false} />
                      ) : (
                        <div className="grid aspect-video place-items-center rounded-lg bg-surface-3 text-[11.5px] text-muted-foreground">
                          Tidak dipakai
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                {jumlahKameraDipakai === 0 ? (
                  <b className="text-alpa">
                    Belum ada kamera yang dipakai — tidak ada scan yang masuk dari perangkat ini.
                  </b>
                ) : (
                  <>
                    <b className="num">{jumlahKameraDipakai}</b> kamera dipakai memindai di{' '}
                    <b>Konsol Scan</b>.
                  </>
                )}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kenali Scanner</CardTitle>
          <CardHint>cara paling aman memberi nama tiap gerbang</CardHint>
          <div className="ml-auto">
            {modeAktif ? (
              <Button
                variant="destructive-outline"
                size="sm"
                disabled={hentikan.isPending}
                onClick={() =>
                  hentikan.mutate(undefined, {
                    onSuccess: () => {
                      setSisaDetik(0);
                      toastSukses('Mode identifikasi dihentikan');
                    },
                  })
                }
              >
                Hentikan ({sisaDetik}s)
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                disabled={mulai.isPending || !d.agent.online}
                onClick={() =>
                  mulai.mutate(undefined, {
                    onSuccess: (h) => {
                      setSisaDetik(h.detik);
                      toastSukses('Mode identifikasi aktif', h.pesan);
                    },
                    onError: (e) => toastGagal(e, 'Gagal memulai mode identifikasi'),
                  })
                }
              >
                {mulai.isPending ? <Loader2Icon className="animate-spin" /> : <RadarIcon />}
                Kenali Scanner
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="text-[13px] leading-relaxed text-muted-foreground">
          {modeAktif ? (
            <p className="font-medium text-primary-ink">
              Tempelkan barcode apa saja ke scanner yang ingin diberi nama. Barisnya akan langsung
              tersorot di bawah dan kursor pindah ke kolom Kode — scan ini{' '}
              <b>tidak dicatat sebagai presensi</b>.
            </p>
          ) : (
            <p>
              Tidak perlu mencatat nomor COM sama sekali. Tekan tombol di atas, lalu tempelkan
              barcode ke scanner satu per satu; sistem yang menentukan port mana yang barusan
              dipakai.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Port Terdeteksi</CardTitle>
          {/*
            Daftar port disimpan di memori server dari laporan terakhir agent.
            Saat agent offline, isinya tetap tampil — tanpa keterangan ini,
            layar terlihat bertentangan: "agent belum melapor" tapi portnya ada.
          */}
          <CardHint>
            {d.terdeteksi.length} port
            {!d.agent.online && d.terdeteksi.length > 0 && ' · dari laporan terakhir, agent sedang offline'}
          </CardHint>
          <Button
            size="sm"
            variant="default"
            className="ml-auto"
            disabled={!berubah || simpan.isPending}
            onClick={simpanSemua}
          >
            {simpan.isPending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
            Simpan pemetaan
          </Button>
        </CardHeader>

        <CardContentFlush>
          {d.terdeteksi.length === 0 ? (
            <EmptyState
              ikon={<UsbIcon />}
              judul="Belum ada port yang terdeteksi"
              deskripsi="Port muncul di sini begitu Scanner Agent di PC gerbang melapor. Pastikan scanner dicolok dan agent-nya berjalan."
            />
          ) : (
            <TableWrap>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Perangkat</TableHead>
                    <TableHead className="w-36">Kode</TableHead>
                    <TableHead className="w-52">Label</TableHead>
                    <TableHead className="w-24 text-center">Aktif</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.terdeteksi.map((p) => {
                    const isi = draf[p.kunci] ?? { kode: '', label: '', aktif: true };
                    const sorot = disorot === p.kunci;
                    return (
                      <TableRow
                        key={p.kunci}
                        className={cn(
                          'transition-colors',
                          sorot && 'bg-primary-soft ring-2 ring-primary ring-inset',
                        )}
                      >
                        <TableCell>
                          <div className="num font-semibold">{p.path}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.merek ?? 'Tanpa merek'}
                            {p.vidPid ? ` · ${p.vidPid}` : ''}
                          </div>
                          {p.tanpaNomorSeri && (
                            <div className="mt-1 flex items-start gap-1.5 text-[11.5px] text-terlambat">
                              <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
                              Tanpa nomor seri — pemetaan ikut lokasi colokan USB. Jangan pindah
                              port setelah ini diberi nama.
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            ref={(el) => {
                              inputRef.current[p.kunci] = el;
                            }}
                            value={isi.kode}
                            onChange={(e) => ubah(p.kunci, { kode: e.target.value })}
                            placeholder="GERBANG-1"
                            className="num uppercase"
                            maxLength={20}
                            aria-label={`Kode untuk ${p.path}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={isi.label}
                            onChange={(e) => ubah(p.kunci, { label: e.target.value })}
                            placeholder="Gerbang Depan"
                            aria-label={`Label untuk ${p.path}`}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={isi.aktif}
                            onCheckedChange={(v) => ubah(p.kunci, { aktif: v })}
                            aria-label={`Aktifkan ${p.path}`}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableWrap>
          )}
        </CardContentFlush>
      </Card>

      {d.tidakTerdeteksi.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tersimpan tapi tidak terdeteksi</CardTitle>
            <CardHint>scanner dicabut, atau agent belum jalan</CardHint>
          </CardHeader>
          <CardContentFlush>
            <TableWrap>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kunci</TableHead>
                    <TableHead>Kode</TableHead>
                    <TableHead>Label</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.tidakTerdeteksi.map((s) => (
                    <TableRow key={s.id} className="opacity-70">
                      <TableCell className="num text-xs">{s.id}</TableCell>
                      <TableCell className="num">{s.kode}</TableCell>
                      <TableCell>{s.label}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
          </CardContentFlush>
        </Card>
      )}
    </div>
  );
}
