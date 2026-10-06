'use client';

import { Suspense } from 'react';
import { DaftarSiswa } from './daftar-siswa';

// useSearchParams butuh Suspense saat halaman di-prerender.
export default function HalamanSiswa() {
  return (
    <Suspense fallback={null}>
      <DaftarSiswa />
    </Suspense>
  );
}
