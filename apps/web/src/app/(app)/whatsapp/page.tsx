'use client';

import { Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFilterUrl } from '@/hooks/use-filter-url';
import { TabKoneksi } from './tab-koneksi';
import { TabLog } from './tab-log';
import { TabPengaturanKirim } from './tab-pengaturan-kirim';
import { TabTemplate } from './tab-template';

export default function HalamanWhatsapp() {
  return (
    <Suspense fallback={null}>
      <IsiWhatsapp />
    </Suspense>
  );
}

function IsiWhatsapp() {
  // Tab aktif ikut masuk URL supaya bisa ditautkan, mis. /whatsapp?tab=log
  const [filter, setFilter] = useFilterUrl({ tab: 'koneksi' });

  return (
    <Tabs value={filter.tab} onValueChange={(v) => setFilter({ tab: v })}>
      <TabsList>
        <TabsTrigger value="koneksi">Koneksi</TabsTrigger>
        <TabsTrigger value="template">Template Pesan</TabsTrigger>
        <TabsTrigger value="log">Log Pengiriman</TabsTrigger>
        <TabsTrigger value="kirim">Pengaturan Kirim</TabsTrigger>
      </TabsList>

      <TabsContent value="koneksi">
        <TabKoneksi />
      </TabsContent>
      <TabsContent value="template">
        <TabTemplate />
      </TabsContent>
      <TabsContent value="log">
        <TabLog />
      </TabsContent>
      <TabsContent value="kirim">
        <TabPengaturanKirim />
      </TabsContent>
    </Tabs>
  );
}
