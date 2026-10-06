'use client';

import { useCallback, useEffect, useState } from 'react';

const KUNCI_AKTIF = 'siklon-kamera-aktif';
const KUNCI_PERANGKAT = 'siklon-kamera';
/** Perubahan di satu halaman harus terlihat di halaman lain pada tab yang sama. */
const EVENT = 'siklon:setelan-kamera';

export type SetelanKamera = {
  aktif: boolean;
  /** deviceId semua kamera yang dipakai memindai — bisa lebih dari satu sekaligus. */
  perangkatIds: string[];
};

function bacaDaftar(): string[] {
  const mentah = localStorage.getItem(KUNCI_PERANGKAT);
  if (!mentah) return [];
  try {
    const isi: unknown = JSON.parse(mentah);
    if (Array.isArray(isi)) return isi.filter((x): x is string => typeof x === 'string' && x !== '');
  } catch {
    // Versi lama menyimpan satu deviceId sebagai string biasa. Dibaca sebagai
    // daftar berisi satu supaya setelan yang sudah ada tidak hilang begitu saja.
  }
  return [mentah];
}

function baca(): SetelanKamera {
  try {
    return {
      aktif: localStorage.getItem(KUNCI_AKTIF) === 'ya',
      perangkatIds: bacaDaftar(),
    };
  } catch {
    // localStorage bisa dilarang (mode privat, kebijakan browser).
    return { aktif: false, perangkatIds: [] };
  }
}

/**
 * Setelan kamera untuk pemindaian.
 *
 * Disimpan di perangkat, BUKAN di server: `deviceId` kamera hanya berarti di
 * mesin tempat kamera itu terpasang. PC gerbang, laptop TU, dan HP masing-masing
 * punya pilihannya sendiri — menyimpannya terpusat justru akan salah.
 *
 * Beberapa kamera boleh menyala bersamaan; satu gerbang bisa punya tiga
 * pemindai sekaligus. Semuanya memindai ke antrean yang sama.
 *
 * Diatur di halaman Scanner, dipakai di Konsol Scan.
 */
export function useSetelanKamera() {
  const [setelan, setSetelan] = useState<SetelanKamera>({ aktif: false, perangkatIds: [] });
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    setSetelan(baca());
    setSiap(true);
    const segarkan = () => setSetelan(baca());
    window.addEventListener(EVENT, segarkan);
    // `storage` hanya menyala di tab LAIN; EVENT menutup tab yang sama.
    window.addEventListener('storage', segarkan);
    return () => {
      window.removeEventListener(EVENT, segarkan);
      window.removeEventListener('storage', segarkan);
    };
  }, []);

  const simpan = useCallback((patch: Partial<SetelanKamera>) => {
    const baru = { ...baca(), ...patch };
    try {
      localStorage.setItem(KUNCI_AKTIF, baru.aktif ? 'ya' : 'tidak');
      localStorage.setItem(KUNCI_PERANGKAT, JSON.stringify(baru.perangkatIds));
    } catch {
      /* diabaikan; setelan hanya berlaku selama halaman terbuka */
    }
    setSetelan(baru);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  /** Menyalakan atau mematikan satu kamera tanpa mengusik yang lain. */
  const setPerangkat = useCallback(
    (id: string, nyala: boolean) => {
      const sekarang = baca().perangkatIds;
      const baru = nyala
        ? sekarang.includes(id)
          ? sekarang
          : [...sekarang, id]
        : sekarang.filter((x) => x !== id);
      simpan({ perangkatIds: baru });
    },
    [simpan],
  );

  return { setelan, simpan, setPerangkat, siap };
}
