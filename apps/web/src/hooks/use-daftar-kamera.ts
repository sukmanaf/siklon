'use client';

import { useCallback, useEffect, useState } from 'react';

export type HalanganKamera =
  | { jenis: 'tidak-aman'; host: string }
  | { jenis: 'tidak-didukung' }
  | { jenis: 'izin-ditolak' }
  | { jenis: 'tidak-ada-kamera' }
  | { jenis: 'gagal'; pesan: string };

/**
 * Daftar kamera yang terpasang di perangkat ini.
 *
 * Dipakai halaman Scanner untuk menampilkan saklar per kamera. Dipisah dari
 * `ModeKamera` karena sekarang bisa ada beberapa `ModeKamera` sekaligus —
 * kalau tiap komponen mengenumerasi sendiri, daftarnya diambil berulang kali
 * tanpa guna.
 *
 * `enumerateDevices` mengembalikan label kosong sampai izin kamera diberikan,
 * jadi izinnya diminta dulu sekali lewat stream yang langsung ditutup. Tanpa
 * itu daftarnya cuma berisi "Kamera 1", "Kamera 2" — tidak ada gunanya untuk
 * memilih mana yang webcam PC dan mana yang HP.
 */
export function useDaftarKamera() {
  const [kamera, setKamera] = useState<MediaDeviceInfo[]>([]);
  const [halangan, setHalangan] = useState<HalanganKamera | null>(null);
  const [memuat, setMemuat] = useState(true);

  const muat = useCallback(async () => {
    setMemuat(true);
    if (!window.isSecureContext) {
      setHalangan({ jenis: 'tidak-aman', host: window.location.host });
      setMemuat(false);
      return;
    }
    if (!navigator.mediaDevices?.enumerateDevices) {
      setHalangan({ jenis: 'tidak-didukung' });
      setMemuat(false);
      return;
    }

    try {
      let sudahDiizinkan = false;
      try {
        const izin = await navigator.permissions.query({
          name: 'camera' as PermissionName,
        });
        sudahDiizinkan = izin.state === 'granted';
      } catch {
        // Firefox belum mendukung query izin kamera; jatuh ke jalur meminta.
      }

      if (!sudahDiizinkan) {
        // Dibuka sebentar HANYA untuk membuka label, lalu langsung ditutup.
        const s = await navigator.mediaDevices.getUserMedia({ video: true });
        s.getTracks().forEach((t) => t.stop());
      }

      const semua = await navigator.mediaDevices.enumerateDevices();
      const video = semua.filter((d) => d.kind === 'videoinput');
      setKamera(video);
      setHalangan(video.length === 0 ? { jenis: 'tidak-ada-kamera' } : null);
    } catch (e) {
      const nama = (e as DOMException)?.name;
      if (nama === 'NotAllowedError' || nama === 'SecurityError') {
        setHalangan({ jenis: 'izin-ditolak' });
      } else if (nama === 'NotFoundError') {
        setHalangan({ jenis: 'tidak-ada-kamera' });
      } else {
        setHalangan({ jenis: 'gagal', pesan: (e as Error)?.message ?? 'Tidak diketahui' });
      }
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat();
    // Kamera dicolok atau dicabut saat halaman terbuka — daftarnya ikut berubah.
    const onGanti = () => void muat();
    navigator.mediaDevices?.addEventListener?.('devicechange', onGanti);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', onGanti);
  }, [muat]);

  return { kamera, halangan, memuat, muatUlang: muat };
}
