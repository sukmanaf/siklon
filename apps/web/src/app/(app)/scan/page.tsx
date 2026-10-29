'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  CameraIcon,
  HandIcon,
  MaximizeIcon,
  MinimizeIcon,
  MonitorIcon,
  ScanLineIcon,
  Volume2Icon,
  VolumeXIcon,
} from 'lucide-react';
import type { HasilScan } from '@siklon/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContentFlush, CardHeader, CardHint, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable, type Kolom } from '@/components/data-table';
import { EmptyState } from '@/components/empty-state';
import { IndikatorSambungan, SpandukTerputus } from '@/components/indikator-sambungan';
import { PeringatanGagal } from '@/components/peringatan-gagal';
import { KartuHasilScan } from '@/components/kartu-hasil-scan';
import { StatusBadge } from '@/components/status-badge';
import { usePresensiHarian, useScanKamera } from '@/hooks/use-presensi';
import { useDaftarScanner } from '@/hooks/use-scanner';
import { useSocket } from '@/hooks/use-socket';
import { useSetelanKamera } from '@/hooks/use-setelan-kamera';
import type { HalanganKamera } from '@/hooks/use-daftar-kamera';
import { useLayarPenuh, useWakeLock } from '@/hooks/use-kiosk';
import { kunci } from '@/lib/query-keys';
import { bunyikan, siapkanBunyi } from '@/lib/bunyi';
import { hariIni } from '@/lib/tanggal';
import { toastGagal, toastSukses } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { DialogManual } from './dialog-manual';
import { ModeKamera, PesanHalangan, type JalurPindai } from '@/components/mode-kamera';

const KUNCI_BUNYI = 'siklon-bunyi-scan';
/**
 * Selama ini NIS yang sama tidak dikirim ulang setelah tercatat.
 *
 * Kartu yang tertinggal di depan kamera akan terbaca terus-menerus, dan tiap
 * pembacaan ulang kembali sebagai "sudah absen" — barisnya menumpuk dan layar
 * penuh penolakan padahal siswanya baik-baik saja. Disamakan dengan
 * `scan.debounce_detik` di setelan server (60 detik).
 */
const JEDA_NIS_SAMA_MS = 60_000;
/** Jeda pendek saat permintaan sedang jalan, supaya dua kamera tidak mengirim bersamaan. */
const JEDA_KIRIM_MS = 3000;
const SEMUA = '__semua__';
/** Berapa hasil scan terakhir yang ditahan di layar. */
const MAKS_RIWAYAT = 100;

type BarisRiwayat = {
  urut: number;
  jam: string;
  titikScan: string | null;
  nama: string;
  nis: string;
  kelas: string | null;
  status: HasilScan['status'] | 'DITOLAK';
  /** Scan masuk atau scan pulang — kolom Status menampilkannya berbeda. */
  jenis: 'MASUK' | 'PULANG';
  pesan: string;
  ok: boolean;
};

export default function HalamanKonsolScan() {
  const [bunyiAktif, setBunyiAktif] = useState(true);
  const [hasilTerakhir, setHasilTerakhir] = useState<HasilScan | null>(null);
  const [riwayat, setRiwayat] = useState<BarisRiwayat[]>([]);
  const [filterTitik, setFilterTitik] = useState(SEMUA);
  const [manualBuka, setManualBuka] = useState(false);
  const [kiosk, setKiosk] = useState(false);
  // Kamera menyala/mati diatur di halaman Scanner, bersama pemindai serial.
  const { setelan: kamera, siap: kameraSiap } = useSetelanKamera();
  const [keadaanKamera, setKeadaanKamera] = useState<
    Record<string, { jalur: JalurPindai | null; halangan: HalanganKamera | null; cobaLagi: () => void }>
  >({});
  const urutRef = useRef(0);
  /** NIS -> sampai kapan pengiriman ulangnya ditahan. Berlaku lintas kamera. */
  const tahanRef = useRef<Map<string, number>>(new Map());

  /*
   * Kamera yang dipakai memindai di layar ini. Setelan lama hanya menyimpan
   * satu kamera; daftar kosong dengan saklar induk menyala berarti setelan
   * versi lama, dan '' membuat browser memilih kameranya sendiri.
   */
  const idsKamera = useMemo(() => {
    if (!kamera.aktif) return [];
    return kamera.perangkatIds.length > 0 ? kamera.perangkatIds : [''];
  }, [kamera.aktif, kamera.perangkatIds]);

  const kameraBermasalah = useMemo(
    () => Object.values(keadaanKamera).filter((k) => k.halangan).length,
    [keadaanKamera],
  );

  /*
   * Hanya halangan yang BISA DITINDAKLANJUTI petugas yang dijelaskan panjang
   * di layar ini: izin yang ditolak dan alamat non-HTTPS, keduanya butuh
   * langkah perbaikan spesifik yang mustahil ditebak sendiri.
   *
   * Sisanya — kamera dicabut, browser tidak mendukung — tidak ada yang bisa
   * dikerjakan petugas gerbang saat itu juga, dan menampilkan kartu sebesar
   * itu hanya memakan layar. Keadaannya tetap terlaporkan lewat lencana
   * "N kamera bermasalah" di bilah atas.
   */
  const halanganPerluTindakan = useMemo(
    () =>
      Object.entries(keadaanKamera).filter(
        ([, k]) => k.halangan?.jenis === 'izin-ditolak' || k.halangan?.jenis === 'tidak-aman',
      ),
    [keadaanKamera],
  );
  const jalurPindai = useMemo(
    () => Object.values(keadaanKamera).find((k) => k.jalur)?.jalur ?? null,
    [keadaanKamera],
  );

  const layar = useLayarPenuh();
  const wakeLock = useWakeLock(kiosk);

  const qc = useQueryClient();
  const scanner = useDaftarScanner();
  const harian = usePresensiHarian(hariIni());
  const scanKamera = useScanKamera();

  useEffect(() => {
    try {
      setBunyiAktif(localStorage.getItem(KUNCI_BUNYI) !== 'mati');
    } catch {
      /* diabaikan */
    }
  }, []);

  const tambahRiwayat = useCallback((h: HasilScan) => {
    const baris: BarisRiwayat = {
      urut: 0,
      jam: h.jam,
      titikScan: h.titikScan,
      nama: h.siswa?.nama ?? '—',
      nis: h.siswa?.nis ?? '—',
      kelas: h.siswa?.kelas ?? null,
      status: h.ok ? (h.status ?? 'HADIR') : 'DITOLAK',
      jenis: h.jenis ?? 'MASUK',
      pesan: h.pesan,
      ok: h.ok,
    };

    setRiwayat((r) => {
      // Presensi manual (dan scan kamera) sampai dua kali ke sini: sekali
      // sebagai balasan HTTP, sekali lagi sebagai siaran socket. Keduanya
      // menggambarkan satu kejadian yang sama, jadi yang kedua diabaikan.
      const kembar = r.some(
        (x) =>
          x.nis === baris.nis &&
          x.jam === baris.jam &&
          x.titikScan === baris.titikScan &&
          x.status === baris.status &&
          x.jenis === baris.jenis,
      );
      if (kembar) return r;

      urutRef.current += 1;
      return [{ ...baris, urut: urutRef.current }, ...r].slice(0, MAKS_RIWAYAT);
    });
  }, []);

  const tanganiHasil = useCallback(
    (h: HasilScan) => {
      // Abaikan sepenuhnya jika NIS salah (jangan masuk tabel, jangan bunyi, jangan ada notif)
      if (h.kode === 'NIS_TIDAK_DITEMUKAN') return;

      setHasilTerakhir(h);
      tambahRiwayat(h);
      if (bunyiAktif) {
        bunyikan(!h.ok ? 'gagal' : h.status === 'TERLAMBAT' ? 'terlambat' : 'sukses');
      }
      // Angka ringkasan di atas layar ikut naik. Tanpa ini operator melihat
      // "0 hadir" padahal scan terus berdatangan — dan itu bikin ragu apakah
      // sistemnya benar-benar mencatat.
      if (h.ok) void qc.invalidateQueries({ queryKey: kunci.presensi.akar });
    },
    [bunyiAktif, tambahRiwayat, qc],
  );

  // Semua scan — dari scanner serial mana pun, dan dari presensi manual —
  // sampai ke layar ini lewat satu jalur yang sama: siaran Socket.IO.
  const { status, percobaan, alasan } = useSocket({
    onScan: (h) => tanganiHasil(h as HasilScan),
  });

  /**
   * Kamera mendekode NIS di browser, dan scanner USB yang masih mode keyboard
   * (belum/tidak bisa dipindah ke mode serial — lihat listener keyboard-wedge
   * di bawah) sama-sama "mengetik" NIS yang lalu dikirim ke endpoint scan
   * ber-JWT lewat fungsi ini. Hasilnya scan sungguhan — sama persis dengan
   * yang datang dari pemindai serial di gerbang, bukan koreksi manual.
   */
  const catatKode = useCallback(
    (kode: string) => {
      /*
       * Beberapa kamera bisa membaca kartu yang SAMA hampir bersamaan — dua
       * kamera bersebelahan di satu gerbang, misalnya. Tiap ModeKamera punya
       * penolak ulangannya sendiri, tapi keduanya tidak saling tahu; penahan
       * di sini yang berlaku untuk semuanya.
       */
      const sekarang = Date.now();
      const tahan = tahanRef.current;
      for (const [nis, sampai] of tahan) if (sampai <= sekarang) tahan.delete(nis);
      if ((tahan.get(kode) ?? 0) > sekarang) return;
      tahan.set(kode, sekarang + JEDA_KIRIM_MS);

      scanKamera.mutate(
        { nis: kode },
        {
          onSuccess: (h) => {
            // Sudah tercatat (atau memang sudah absen sebelumnya): tahan lama,
            // supaya kartu yang tertinggal di depan kamera tidak bikin gaduh.
            if (h.ok || h.kode === 'SUDAH_ABSEN' || h.kode === 'SUDAH_IZIN') {
              tahan.set(kode, Date.now() + JEDA_NIS_SAMA_MS);
            } else {
              // Penolakan lain (mis. NIS tidak terdaftar, hari libur) mungkin
              // dibereskan operator lalu kartunya ditempel lagi — jangan ditahan.
              tahan.delete(kode);
            }
            tanganiHasil(h);
            if (h.ok) toastSukses(`${h.siswa?.nama ?? kode} tercatat`);
          },
          onError: (e) => {
            // Gagal karena jaringan; kartu yang sama harus boleh dicoba lagi.
            tahan.delete(kode);
            if (bunyiAktif) bunyikan('gagal');
            toastGagal(e, `Scan ${kode} gagal dicatat`);
          },
        },
      );
    },
    [scanKamera, tanganiHasil, bunyiAktif],
  );

  /*
   * Sebagian scanner USB tetap dalam mode keyboard (HID/"keyboard-wedge")
   * bawaannya — belum berhasil dipindah ke mode serial lewat barcode
   * konfigurasi khusus pabrikan. Selama begitu, dia "mengetik" NIS ke
   * elemen mana pun yang sedang fokus di halaman, diakhiri Enter.
   *
   * Ketikan scanner jauh lebih cepat dari manusia (biasanya <10ms antar
   * karakter), jadi dibedakan lewat jeda: kalau jeda antar-karakter
   * melebihi ambang ini, buffer dianggap ketikan manusia biasa dan
   * direset — supaya orang mengetik normal di kolom lain tidak kepencet
   * jadi "scan". Begitu scanner berhasil dipindah ke mode serial,
   * listener ini otomatis diam sendiri (tidak ada lagi ketikan yang
   * masuk) — tidak perlu dimatikan manual.
   */
  useEffect(() => {
    // JS Keyboard Scanner Fallback DIMATIKAN secara sengaja agar tidak tabrakan
    // dengan AgenScannerRaw.exe C# Raw Input yang bekerja di background.
  }, [catatKode]);


  // Titik scan yang bisa dipilih: dari pemetaan tersimpan + yang muncul di riwayat.
  const titikScan = useMemo(() => {
    const set = new Set<string>();
    for (const t of scanner.data?.terdeteksi ?? []) if (t.kode) set.add(t.kode);
    for (const t of scanner.data?.tidakTerdeteksi ?? []) set.add(t.kode);
    for (const r of riwayat) if (r.titikScan) set.add(r.titikScan);
    return [...set].sort();
  }, [scanner.data, riwayat]);

  const riwayatTersaring = useMemo(
    () => (filterTitik === SEMUA ? riwayat : riwayat.filter((r) => r.titikScan === filterTitik)),
    [riwayat, filterTitik],
  );

  const r = harian.data?.ringkasan;

  const kolom: Kolom<BarisRiwayat>[] = [
    {
      kunci: 'jam',
      judul: 'Jam',
      render: (b) => <span className="num font-semibold">{b.jam}</span>,
    },
    {
      kunci: 'siswa',
      judul: 'Siswa',
      render: (b) => (
        <div className="min-w-0">
          <div className="truncate font-semibold">{b.nama}</div>
          <div className="num truncate text-xs text-muted-foreground">
            {b.nis}
            {b.kelas ? ` · ${b.kelas}` : ''}
          </div>
        </div>
      ),
    },
    {
      kunci: 'status',
      judul: 'Status',
      render: (b) =>
        b.status === 'DITOLAK' ? (
          <Badge variant="danger">Ditolak</Badge>
        ) : b.jenis === 'PULANG' ? (
          <Badge variant="info">Pulang</Badge>
        ) : (
          <StatusBadge status={b.status === 'TERLAMBAT' ? 'TERLAMBAT' : 'HADIR'} />
        ),
    },
    {
      kunci: 'titik',
      judul: 'Titik Scan',
      render: (b) => (
        <span className="num text-muted-foreground">{b.titikScan ?? '—'}</span>
      ),
    },
    {
      kunci: 'pesan',
      judul: 'Keterangan',
      render: (b) => (
        <span className={cn('text-[12.5px]', b.ok ? 'text-muted-foreground' : 'text-alpa')}>
          {b.pesan}
        </span>
      ),
    },
  ];

  async function masukKiosk() {
    siapkanBunyi();
    setKiosk(true);
    await layar.masuk();
  }

  async function keluarKiosk() {
    setKiosk(false);
    await layar.keluar();
  }

  // Esc keluar dari layar penuh tapi tidak dari overlay; samakan keduanya
  // supaya petugas tidak terjebak di layar yang seolah tidak bisa ditutup.
  useEffect(() => {
    if (!kiosk) return;
    const onTombol = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void keluarKiosk();
    };
    window.addEventListener('keydown', onTombol);
    return () => window.removeEventListener('keydown', onTombol);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kiosk]);

  return (
    <div
      data-uji={kiosk ? 'kiosk-aktif' : undefined}
      className={cn(
        'space-y-4',
        // Mode kiosk: menutupi sidebar dan topbar, bukan membongkar layoutnya.
        kiosk && 'fixed inset-0 z-50 overflow-y-auto bg-background p-4 sm:p-6',
      )}
    >
      <SpandukTerputus status={status} />

      {(harian.isError || scanner.isError) && (
        <PeringatanGagal
          judul="Data pendukung gagal dimuat."
          error={harian.error ?? scanner.error}
          onCobaLagi={() => {
            void harian.refetch();
            void scanner.refetch();
          }}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <IndikatorSambungan status={status} percobaan={percobaan} alasan={alasan} />

        {scanner.data && (
          <Badge variant={scanner.data.agent.online ? 'ok' : 'danger'}>
            Scanner Agent {scanner.data.agent.online ? 'online' : 'offline'}
          </Badge>
        )}

        {/*
          Layar ini tidak lagi menampilkan video, jadi tanpa lencana ini tidak
          ada cara tahu kameranya benar-benar jalan atau tidak.
        */}
        {kameraSiap && idsKamera.length > 0 && (
          <Badge
            variant={kameraBermasalah > 0 ? 'danger' : 'ok'}
            data-uji="lencana-kamera"
            data-pendekode={jalurPindai ?? ''}
            title={
              kameraBermasalah > 0
                ? 'Ada kamera yang gagal dibuka — periksa di halaman Scanner'
                : `Pendekode: ${jalurPindai ?? 'menyiapkan…'}`
            }
          >
            <CameraIcon className="size-3.5" />
            {kameraBermasalah > 0
              ? `${kameraBermasalah} dari ${idsKamera.length} kamera bermasalah`
              : `${idsKamera.length} kamera memindai`}
          </Badge>
        )}

        {kiosk && (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
              wakeLock === 'aktif' ? 'bg-hadir-bg text-hadir' : 'bg-terlambat-bg text-terlambat',
            )}
            title={
              wakeLock === 'aktif'
                ? 'Layar tidak akan mati selama mode kiosk aktif'
                : 'Browser ini tidak menjaga layar tetap menyala — matikan screensaver lewat setelan sistem'
            }
          >
            <MonitorIcon className="size-3.5" />
            {wakeLock === 'aktif' ? 'Layar dijaga menyala' : 'Layar tidak dijaga'}
          </span>
        )}

        {r && (
          <span className="text-[12.5px] text-muted-foreground">
            Hari ini: <b className="num text-hadir">{r.hadir}</b> hadir ·{' '}
            <b className="num text-terlambat">{r.terlambat}</b> terlambat ·{' '}
            <b className="num text-faint">{r.belum}</b> belum
          </span>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            aria-pressed={bunyiAktif}
            className={bunyiAktif ? 'border-primary text-primary' : undefined}
            onClick={() => {
              const baru = !bunyiAktif;
              setBunyiAktif(baru);
              try {
                localStorage.setItem(KUNCI_BUNYI, baru ? 'nyala' : 'mati');
              } catch {
                /* diabaikan */
              }
              // Klik ini sekaligus gestur yang membangunkan AudioContext.
              if (baru) {
                siapkanBunyi();
                bunyikan('sukses');
              }
            }}
          >
            {bunyiAktif ? <Volume2Icon /> : <VolumeXIcon />}
            Bunyi {bunyiAktif ? 'nyala' : 'mati'}
          </Button>

          <Button size="sm" variant="default" onClick={() => setManualBuka(true)}>
            <HandIcon />
            Presensi manual
          </Button>

          {kiosk ? (
            <Button size="sm" onClick={() => void keluarKiosk()}>
              <MinimizeIcon />
              Keluar kiosk (Esc)
            </Button>
          ) : (
            <Button size="sm" onClick={() => void masukKiosk()}>
              <MaximizeIcon />
              Mode kiosk
            </Button>
          )}
        </div>
      </div>



      {/*
        Video tidak ditampilkan di layar ini, tapi dua halangan yang butuh
        tindakan petugas tetap dijelaskan penuh — lihat halanganPerluTindakan.
      */}
      {halanganPerluTindakan.map(([id, k]) => (
        <PesanHalangan key={id} halangan={k.halangan!} onCobaLagi={k.cobaLagi} />
      ))}

      {/*
        Kiri: siapa yang barusan absen. Kanan: tabelnya. 30/70.
        minmax(0,…) wajib: tanpa itu lebar minimum tabel menang atas pembagian
        `fr`, dan kolom kiri terjepit jadi ~15%.
      */}
      <div
        data-uji="tata-konsol"
        className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]"
      >
        <KartuHasilScan hasil={hasilTerakhir} />

        <Card>
          <CardHeader>
            <CardTitle>Scan hari ini</CardTitle>
            <CardHint>
              {riwayat.length} sejak layar ini dibuka
              {filterTitik !== SEMUA && ` · disaring ${filterTitik}`}
            </CardHint>
            <div className="ml-auto">
              <Select value={filterTitik} onValueChange={setFilterTitik}>
                <SelectTrigger className="w-44" aria-label="Filter titik scan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEMUA}>Semua titik scan</SelectItem>
                  {titikScan.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContentFlush>
            <DataTable
              kolom={kolom}
              data={riwayatTersaring}
              idBaris={(b) => String(b.urut)}
              perHalaman={15}
              kosong={
                <EmptyState
                  ikon={<ScanLineIcon />}
                  judul={
                    filterTitik === SEMUA
                      ? 'Belum ada scan sejak layar ini dibuka'
                      : `Belum ada scan dari ${filterTitik}`
                  }
                  deskripsi="Daftar ini hanya memuat scan yang masuk selagi halaman terbuka. Riwayat lengkap hari ini ada di Laporan Harian."
                />
              }
            />
          </CardContentFlush>
        </Card>
      </div>

      {/*
        Kameranya berjalan tapi videonya tidak ditampilkan — layar ini hanya
        untuk hasil dan tabel. Elemen videonya tetap ada (disembunyikan) karena
        pendekode membaca frame dari situ.
      */}
      {kameraSiap &&
        idsKamera.map((id) => (
          <ModeKamera
            key={id || 'bawaan'}
            aktif
            perangkatId={id || undefined}
            tampilkanVideo={false}
            onKode={catatKode}
            onKeadaan={(k) => setKeadaanKamera((lama) => ({ ...lama, [id]: k }))}
          />
        ))}

      <DialogManual
        buka={manualBuka}
        onTutup={() => setManualBuka(false)}
        onHasil={tanganiHasil}
      />
    </div>
  );
}
