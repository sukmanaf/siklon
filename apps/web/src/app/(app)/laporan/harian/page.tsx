'use client';

import { Suspense } from 'react';
import { IsiLaporanHarian } from './isi';

export default function HalamanLaporanHarian() {
  return (
    <Suspense fallback={null}>
      <IsiLaporanHarian />
    </Suspense>
  );
}
