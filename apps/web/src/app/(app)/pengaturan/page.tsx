'use client';

import { Suspense } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { useSemuaSetting } from '@/hooks/use-pengaturan';
import { useFilterUrl } from '@/hooks/use-filter-url';
import { pesanError } from '@/lib/api';
import { TabJadwal } from './tab-jadwal';
import { TabLibur } from './tab-libur';
import { TabSekolah } from './tab-sekolah';
import { TabTahun } from './tab-tahun';

export default function HalamanPengaturan() {
  return (
    <Suspense fallback={null}>
      <IsiPengaturan />
    </Suspense>
  );
}

function IsiPengaturan() {
  // Tab aktif ikut masuk URL supaya bisa ditautkan langsung, mis. /pengaturan?tab=libur
  const [filter, setFilter] = useFilterUrl({ tab: 'jadwal' });
  const setting = useSemuaSetting();

  if (setting.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-80" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (setting.isError) {
    return (
      <Card>
        <EmptyState
          variant="error"
          judul="Pengaturan tidak bisa dimuat"
          deskripsi={pesanError(setting.error)}
          aksi={
            <Button variant="default" onClick={() => void setting.refetch()}>
              Coba lagi
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <Tabs value={filter.tab} onValueChange={(v) => setFilter({ tab: v })}>
      <TabsList>
        <TabsTrigger value="jadwal">Jadwal &amp; Jam Masuk</TabsTrigger>
        <TabsTrigger value="libur">Hari Libur</TabsTrigger>
        <TabsTrigger value="tahun">Tahun Ajaran</TabsTrigger>
        <TabsTrigger value="sekolah">Identitas Sekolah</TabsTrigger>
      </TabsList>

      <TabsContent value="jadwal">
        <TabJadwal awal={setting.data.presensi} />
      </TabsContent>
      <TabsContent value="libur">
        <TabLibur />
      </TabsContent>
      <TabsContent value="tahun">
        <TabTahun />
      </TabsContent>
      <TabsContent value="sekolah">
        <TabSekolah awal={setting.data.sekolah} />
      </TabsContent>
    </Tabs>
  );
}
