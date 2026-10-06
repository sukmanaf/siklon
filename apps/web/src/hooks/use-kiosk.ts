'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Mencegah layar mati selama Konsol Scan dibuka (FE-044).
 *
 * Layar gerbang menyala berjam-jam tanpa disentuh; tanpa wake lock, PC akan
 * mengunci layar di tengah jam masuk dan petugas tidak lagi melihat hasil scan.
 *
 * Wake Lock dilepas browser sendiri saat tab disembunyikan, jadi ia harus
 * diminta ulang begitu tab kembali terlihat — tanpa itu, kunci hilang diam-diam
 * setelah operator berpindah tab sekali saja.
 */
export function useWakeLock(aktif: boolean) {
  const [status, setStatus] = useState<'mati' | 'aktif' | 'tidak-didukung' | 'gagal'>('mati');
  const kunci = useRef<WakeLockSentinel | null>(null);

  const minta = useCallback(async () => {
    if (!('wakeLock' in navigator)) {
      setStatus('tidak-didukung');
      return;
    }
    try {
      kunci.current = await navigator.wakeLock.request('screen');
      setStatus('aktif');
      kunci.current.addEventListener('release', () => setStatus('mati'));
    } catch {
      // Ditolak browser (mis. baterai kritis). Bukan alasan menggagalkan layar.
      setStatus('gagal');
    }
  }, []);

  useEffect(() => {
    if (!aktif) {
      void kunci.current?.release().catch(() => undefined);
      kunci.current = null;
      setStatus('mati');
      return;
    }

    void minta();
    const onTampil = () => {
      if (document.visibilityState === 'visible') void minta();
    };
    document.addEventListener('visibilitychange', onTampil);

    return () => {
      document.removeEventListener('visibilitychange', onTampil);
      void kunci.current?.release().catch(() => undefined);
      kunci.current = null;
    };
  }, [aktif, minta]);

  return status;
}

/**
 * Layar penuh. Dipisah dari wake lock karena keduanya bisa gagal sendiri-sendiri:
 * `requestFullscreen` menuntut gestur pengguna, sedangkan wake lock tidak.
 */
export function useLayarPenuh() {
  const [penuh, setPenuh] = useState(false);

  useEffect(() => {
    const onUbah = () => setPenuh(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onUbah);
    return () => document.removeEventListener('fullscreenchange', onUbah);
  }, []);

  const masuk = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Beberapa browser menolak tanpa gestur langsung; mode kiosk tetap jalan
      // sebagai overlay layar penuh, hanya tanpa menyembunyikan bilah browser.
    }
  }, []);

  const keluar = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
  }, []);

  return { penuh, masuk, keluar };
}
