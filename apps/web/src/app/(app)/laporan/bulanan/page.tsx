'use client';

import { Suspense } from 'react';
import { IsiLaporanBulanan } from './isi';

export default function HalamanLaporanBulanan() {
  return (
    <Suspense fallback={null}>
      <IsiLaporanBulanan />
    </Suspense>
  );
}
