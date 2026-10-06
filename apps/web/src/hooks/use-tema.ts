'use client';

import { useCallback, useEffect, useState } from 'react';
import { KUNCI_TEMA, type Tema } from '@/lib/tema';

export { KUNCI_TEMA, type Tema };

function terapkan(tema: Tema) {
  const gelap =
    tema === 'gelap' ||
    (tema === 'sistem' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset['theme'] = gelap ? 'dark' : 'light';
}

/**
 * Pilihan tema, tersimpan di localStorage.
 *
 * Penerapan pertama TIDAK dilakukan di sini melainkan oleh skrip pemblokir di
 * <head> (ScriptTema) — kalau menunggu React, halaman sempat tampil terang
 * sekejap sebelum berubah gelap.
 */
export function useTema() {
  const [tema, setTemaState] = useState<Tema>('sistem');

  useEffect(() => {
    const tersimpan = localStorage.getItem(KUNCI_TEMA) as Tema | null;
    if (tersimpan === 'terang' || tersimpan === 'gelap' || tersimpan === 'sistem') {
      setTemaState(tersimpan);
    }
  }, []);

  // Ikut berubah saat pengguna mengganti tema sistem operasinya.
  useEffect(() => {
    if (tema !== 'sistem') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onUbah = () => terapkan('sistem');
    mq.addEventListener('change', onUbah);
    return () => mq.removeEventListener('change', onUbah);
  }, [tema]);

  const setTema = useCallback((baru: Tema) => {
    setTemaState(baru);
    localStorage.setItem(KUNCI_TEMA, baru);
    terapkan(baru);
  }, []);

  return { tema, setTema };
}
