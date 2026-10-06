'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Menyimpan keadaan filter di query string, bukan di useState.
 *
 * Alasannya bukan sekadar rapi: halaman hasil filter jadi bisa di-bookmark dan
 * dikirim ke rekan kerja, dan tombol Back browser mengembalikan filter
 * sebelumnya alih-alih keluar dari halaman (FE-013).
 *
 * Nilai kosong dihapus dari URL supaya alamatnya tidak penuh parameter kosong.
 */
export function useFilterUrl<T extends Record<string, string | undefined>>(bawaan: T) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const nilai = useMemo(() => {
    const hasil = { ...bawaan };
    for (const k of Object.keys(bawaan) as (keyof T)[]) {
      const v = params.get(String(k));
      if (v !== null) hasil[k] = v as T[keyof T];
    }
    return hasil;
    // params sengaja jadi dependensi lewat toString(): objeknya beridentitas
    // baru tiap render walau isinya sama.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString()]);

  const setFilter = useCallback(
    (patch: Partial<T>, opsi?: { ganti?: boolean }) => {
      const baru = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === '' || v === bawaan[k as keyof T]) baru.delete(k);
        else baru.set(k, String(v));
      }
      const qs = baru.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      // `replace` dipakai untuk perubahan yang tidak layak jadi entri riwayat
      // sendiri — mengetik pencarian huruf demi huruf, misalnya.
      if (opsi?.ganti) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [params, pathname, router, bawaan],
  );

  return [nilai, setFilter] as const;
}
