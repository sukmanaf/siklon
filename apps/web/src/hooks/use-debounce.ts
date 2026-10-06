'use client';

import { useEffect, useState } from 'react';

/**
 * Menunda nilai sampai pengetikan berhenti.
 *
 * Dipakai kotak pencarian: tanpa ini setiap huruf menembak satu permintaan ke
 * server — mengetik "Andi" berarti empat query pencarian trigram.
 */
export function useDebounce<T>(nilai: T, jeda = 350): T {
  const [tertunda, setTertunda] = useState(nilai);

  useEffect(() => {
    const t = setTimeout(() => setTertunda(nilai), jeda);
    return () => clearTimeout(t);
  }, [nilai, jeda]);

  return tertunda;
}
