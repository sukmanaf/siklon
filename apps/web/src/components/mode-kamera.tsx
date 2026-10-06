'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraIcon, CameraOffIcon, LockKeyholeIcon, TriangleAlertIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { HalanganKamera } from '@/hooks/use-daftar-kamera';
import { cn } from '@/lib/utils';

/** Kode yang sama diabaikan selama ini, supaya satu kartu tidak terbaca berkali-kali. */
const JEDA_ULANG_MS = 3000;

export type JalurPindai = 'BarcodeDetector' | 'qr-scanner';

/**
 * Satu kamera yang sedang memindai (FE-029, FE-030, FE-048).
 *
 * Komponen ini mengurus SATU kamera saja. Beberapa kamera dipakai sekaligus
 * dengan merender beberapa komponen ini, satu per `perangkatId` — bukan dengan
 * membuat komponen ini menangani banyak stream, yang akan membuat penanganan
 * izin dan galatnya bercampur jadi satu.
 *
 * Dua kegagalan paling sering ditangani dengan pesan khusus, bukan pesan
 * generik "kamera tidak bisa dibuka":
 *
 *  1. Halaman dibuka lewat http:// selain localhost. Browser mematikan
 *     `navigator.mediaDevices` **tanpa pesan apa pun**, jadi tanpa penjelasan
 *     ini orang akan mengira kameranya rusak. Ini yang terjadi saat konsol
 *     dibuka dari HP lewat http://192.168.x.x.
 *  2. Izin kamera ditolak — harus dipulihkan lewat setelan situs di browser,
 *     bukan dengan memuat ulang halaman.
 *
 * Pendekodenya memakai `BarcodeDetector` bila tersedia, dan jatuh ke pustaka
 * `qr-scanner` bila tidak. Chrome di Linux **tidak punya** BarcodeDetector,
 * jadi jalur cadangan itulah yang dipakai selama pengembangan.
 */
export function ModeKamera({
  aktif,
  perangkatId,
  onKode,
  pindai = true,
  tampilkanVideo = true,
  onKeadaan,
}: {
  aktif: boolean;
  /** Kamera mana yang dibuka. Kosong = biarkan browser memilih (kamera belakang). */
  perangkatId?: string;
  onKode: (kode: string) => void;
  /** false = hanya pratinjau; QR tidak didekode dan tidak ada presensi tercatat. */
  pindai?: boolean;
  /**
   * false = kamera tetap berjalan tapi videonya tidak ditampilkan.
   * Dipakai Konsol Scan, yang hanya menampilkan hasil dan tabel.
   */
  tampilkanVideo?: boolean;
  /**
   * Melaporkan jalur pendekode dan halangan ke atas. Pemanggil yang
   * menyembunyikan video tidak bisa melihat pesan galatnya sendiri, padahal
   * justru di layar itulah petugas perlu tahu kameranya bermasalah.
   */
  onKeadaan?: (k: {
    jalur: JalurPindai | null;
    halangan: HalanganKamera | null;
    cobaLagi: () => void;
  }) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const berhentiRef = useRef<(() => void) | null>(null);
  const terakhirRef = useRef<{ kode: string; pada: number } | null>(null);

  const [halangan, setHalangan] = useState<HalanganKamera | null>(null);
  const [jalanDengan, setJalanDengan] = useState<JalurPindai | null>(null);
  /** Dinaikkan oleh tombol "Coba lagi" untuk menjalankan ulang efeknya. */
  const [percobaan, setPercobaan] = useState(0);

  /*
   * onKode dan onKeadaan disimpan di ref, dan SENGAJA tidak jadi dependensi
   * efek pembuka kamera.
   *
   * Pemanggil hampir selalu mengoper fungsi yang beridentitas baru tiap render
   * (arrow function inline, atau useCallback yang bergantung pada objek
   * useMutation). Kalau identitas itu ikut jadi dependensi, efeknya dijalankan
   * ulang tiap render: kamera dimatikan lalu dinyalakan lagi terus-menerus —
   * terlihat sebagai video yang berkedip nyala-mati.
   */
  const onKodeRef = useRef(onKode);
  const onKeadaanRef = useRef(onKeadaan);
  useEffect(() => {
    onKodeRef.current = onKode;
    onKeadaanRef.current = onKeadaan;
  });

  const cobaLagi = useCallback(() => setPercobaan((n) => n + 1), []);

  useEffect(() => {
    onKeadaanRef.current?.({ jalur: jalanDengan, halangan, cobaLagi });
  }, [jalanDengan, halangan, cobaLagi]);

  const laporKode = useCallback((kode: string) => {
    const bersih = kode.trim();
    if (!bersih) return;
    const t = terakhirRef.current;
    if (t && t.kode === bersih && Date.now() - t.pada < JEDA_ULANG_MS) return;
    terakhirRef.current = { kode: bersih, pada: Date.now() };
    onKodeRef.current(bersih);
  }, []);

  const hentikan = useCallback(() => {
    berhentiRef.current?.();
    berhentiRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setJalanDengan(null);
  }, []);

  useEffect(() => {
    if (!aktif) {
      hentikan();
      return;
    }

    let batal = false;

    async function mulai() {
      // 1. Konteks aman. Ini pemeriksaan pertama karena penyebabnya paling
      //    sering dan gejalanya paling membingungkan.
      if (!window.isSecureContext) {
        setHalangan({ jenis: 'tidak-aman', host: window.location.host });
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setHalangan({ jenis: 'tidak-didukung' });
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: perangkatId
            ? { deviceId: { exact: perangkatId } }
            : { facingMode: { ideal: 'environment' } },
        });
      } catch (e) {
        const nama = (e as DOMException)?.name;
        if (nama === 'NotAllowedError' || nama === 'SecurityError') {
          setHalangan({ jenis: 'izin-ditolak' });
        } else if (nama === 'NotFoundError' || nama === 'OverconstrainedError') {
          // deviceId tersimpan bisa milik kamera yang sudah dicabut.
          setHalangan({ jenis: 'tidak-ada-kamera' });
        } else {
          setHalangan({ jenis: 'gagal', pesan: (e as Error)?.message ?? 'Tidak diketahui' });
        }
        return;
      }
      if (batal) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      setHalangan(null);
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);

      // Mode pratinjau: video saja, tanpa mendekode apa pun. Dipakai halaman
      // Scanner untuk memastikan kamera yang dipilih benar.
      if (!pindai) return;

      // 2. Pendekode: BarcodeDetector bila ada, kalau tidak qr-scanner.
      const Detector = (
        window as unknown as {
          BarcodeDetector?: new (o: { formats: string[] }) => {
            detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]>;
          };
        }
      ).BarcodeDetector;

      if (Detector) {
        setJalanDengan('BarcodeDetector');
        const detector = new Detector({ formats: ['qr_code'] });
        let frame = 0;
        const pindaiFrame = async () => {
          if (batal) return;
          try {
            const hasil = await detector.detect(video);
            if (hasil[0]?.rawValue) laporKode(hasil[0].rawValue);
          } catch {
            /* frame gagal didekode itu normal; lanjut saja */
          }
          frame = requestAnimationFrame(() => void pindaiFrame());
        };
        void pindaiFrame();
        berhentiRef.current = () => cancelAnimationFrame(frame);
        return;
      }

      setJalanDengan('qr-scanner');
      const { default: QrScanner } = await import('qr-scanner');
      if (batal) return;

      /*
       * Dipakai `scanImage` dalam loop sendiri, BUKAN `new QrScanner(video).start()`.
       *
       * Kelas QrScanner ingin mengelola kameranya sendiri — ia meminta stream
       * dan memasang srcObject-nya sendiri. Komponen ini sudah melakukan itu
       * (demi pilihan kamera tersimpan dan pesan izin yang jelas), jadi
       * keduanya berebut elemen video yang sama: pemindainya "start" tanpa
       * error, tapi loop-nya tidak pernah mengirim satu frame pun ke worker.
       * Gejalanya paling menyesatkan — kamera tampil normal dan tidak ada
       * error, tapi QR tidak pernah terbaca.
       *
       * Dengan scanImage, alurnya jadi sama persis dengan jalur BarcodeDetector.
       */
      let mesin: Awaited<ReturnType<typeof QrScanner.createQrEngine>>;
      try {
        // Satu mesin dipakai ulang; membuatnya tiap frame berarti satu worker
        // baru tiap frame.
        mesin = await QrScanner.createQrEngine();
      } catch (e) {
        console.error('[SIKLON] mesin qr-scanner gagal dibuat:', e);
        setHalangan({ jenis: 'gagal', pesan: (e as Error)?.message ?? 'Pemindai QR gagal dijalankan' });
        return;
      }
      if (batal) {
        if (mesin instanceof Worker) mesin.terminate();
        return;
      }

      let frameQr = 0;
      let sedangPindai = false;
      const pindaiQr = async () => {
        if (batal) return;
        // Lewati frame bila pemindaian sebelumnya belum selesai; menumpuk
        // permintaan ke worker hanya menambah jeda.
        if (!sedangPindai && video.readyState >= 2) {
          sedangPindai = true;
          try {
            const hasil = await QrScanner.scanImage(video, {
              qrEngine: mesin,
              returnDetailedScanResult: true,
            });
            if (hasil?.data) laporKode(hasil.data);
          } catch {
            // Frame tanpa QR melempar — itu keadaan normal, bukan kesalahan.
          } finally {
            sedangPindai = false;
          }
        }
        frameQr = requestAnimationFrame(() => void pindaiQr());
      };
      void pindaiQr();

      berhentiRef.current = () => {
        cancelAnimationFrame(frameQr);
        if (mesin instanceof Worker) mesin.terminate();
      };
    }

    void mulai();
    return () => {
      batal = true;
      hentikan();
    };
  }, [aktif, perangkatId, pindai, percobaan, laporKode, hentikan]);

  /*
   * Elemen video tetap dirender meski disembunyikan: pendekode membaca frame
   * DARI elemen ini. Dengan `display:none` (atau tanpa elemennya sama sekali)
   * tidak ada frame yang bisa dibaca dan pemindaian berhenti diam-diam.
   */
  if (!tampilkanVideo) {
    return (
      <video
        ref={videoRef}
        muted
        playsInline
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none fixed top-0 left-0 size-px opacity-0"
      />
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-slate-950">
      <video
        ref={videoRef}
        muted
        playsInline
        className={cn('aspect-video w-full object-cover', halangan && 'opacity-0')}
      />

      {halangan && (
        <div className="absolute inset-0 grid place-items-center p-4">
          <PesanHalangan halangan={halangan} onCobaLagi={cobaLagi} />
        </div>
      )}

      {!halangan && jalanDengan && (
        <span className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">
          {jalanDengan}
        </span>
      )}
    </div>
  );
}

export function PesanHalangan({
  halangan,
  onCobaLagi,
}: {
  halangan: HalanganKamera;
  onCobaLagi: () => void;
}) {
  const isi = {
    'tidak-aman': {
      Ikon: LockKeyholeIcon,
      judul: 'Kamera diblokir karena alamatnya bukan HTTPS',
      pesan: (
        <>
          Browser hanya mengizinkan kamera di <b className="num">localhost</b> atau lewat{' '}
          <b>https://</b>. Halaman ini dibuka di <b className="num">{('host' in halangan && halangan.host) || ''}</b>,
          jadi kameranya dimatikan tanpa pesan apa pun. Buka lewat{' '}
          <b className="num">http://localhost:3000</b> di PC gerbang, atau pasang HTTPS lebih dulu.
        </>
      ),
    },
    'tidak-didukung': {
      Ikon: CameraOffIcon,
      judul: 'Browser ini tidak mendukung kamera',
      pesan: <>Coba Chrome atau Firefox versi terbaru.</>,
    },
    'izin-ditolak': {
      Ikon: CameraOffIcon,
      judul: 'Izin kamera ditolak',
      pesan: (
        <>
          Klik ikon gembok di sebelah alamat halaman, izinkan <b>Kamera</b>, lalu muat ulang.
          Memuat ulang saja tidak cukup — izinnya harus diubah dulu di setelan situs.
        </>
      ),
    },
    'tidak-ada-kamera': {
      Ikon: CameraOffIcon,
      judul: 'Kamera tidak ditemukan',
      pesan: <>Perangkatnya mungkin dicabut. Colokkan kembali lalu coba lagi.</>,
    },
    gagal: {
      Ikon: TriangleAlertIcon,
      judul: 'Kamera gagal dibuka',
      pesan: <span className="num">{('pesan' in halangan && halangan.pesan) || ''}</span>,
    },
  }[halangan.jenis];

  return (
    <div className="max-w-md rounded-xl bg-card p-5 text-center shadow-card">
      <isi.Ikon className="mx-auto mb-2 size-8 text-alpa" />
      <p className="text-sm font-semibold">{isi.judul}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{isi.pesan}</p>
      {halangan.jenis !== 'tidak-aman' && (
        <Button size="sm" variant="default" className="mt-3" onClick={onCobaLagi}>
          <CameraIcon />
          Coba lagi
        </Button>
      )}
    </div>
  );
}
