'use client';

import { Suspense } from 'react';
import { IsiKelolaPresensi } from './isi';

export default function HalamanKelolaPresensi() {
  return (
    <Suspense fallback={null}>
      <IsiKelolaPresensi />
    </Suspense>
  );
}
