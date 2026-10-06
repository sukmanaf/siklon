'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { JUDUL_AWALAN, JUDUL_HALAMAN } from '@/lib/navigasi';
import { tanggalPanjang } from '@/lib/utils';
import type { Saya } from '@/hooks/use-auth';

/**
 * Kerangka aplikasi: sidebar tetap di kiri, topbar menempel di atas, konten
 * di tengah. Di layar < 768px sidebar berubah jadi laci yang bisa ditarik —
 * halaman ini akan sering dibuka dari tablet di ruang TU.
 */
export function AppShell({ saya, children }: { saya: Saya; children: React.ReactNode }) {
  const pathname = usePathname();
  const [laciTerbuka, setLaciTerbuka] = useState(false);

  // Berpindah halaman lewat tombol Back tidak memicu onPilih; tutup lacinya di sini.
  useEffect(() => setLaciTerbuka(false), [pathname]);

  const info =
    JUDUL_HALAMAN[pathname] ??
    JUDUL_AWALAN.find((j) => pathname.startsWith(j.awalan)) ??
    { judul: 'SIKLON' };
  const [tanggal, setTanggal] = useState<string | null>(null);
  // Tanggal dihitung di klien saja: server dan browser bisa beda zona waktu,
  // dan selisihnya akan terbaca React sebagai hydration mismatch.
  useEffect(() => setTanggal(tanggalPanjang(new Date())), []);

  return (
    <div className="grid min-h-screen md:grid-cols-[236px_1fr]">
      <div className="sticky top-0 hidden h-screen md:block">
        <Sidebar peran={saya.peran} nama={saya.nama} />
      </div>

      <Dialog.Root open={laciTerbuka} onOpenChange={setLaciTerbuka}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/55 md:hidden" />
          <Dialog.Content
            className="fixed inset-y-0 left-0 z-50 w-60 outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-left md:hidden"
            aria-describedby={undefined}
          >
            <Dialog.Title className="sr-only">Menu navigasi</Dialog.Title>
            <Sidebar
              peran={saya.peran}
              nama={saya.nama}
              onPilih={() => setLaciTerbuka(false)}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="flex min-w-0 flex-col">
        <Topbar
          judul={info.judul}
          sub={info.sub ?? tanggal ?? undefined}
          saya={saya}
          onBukaMenu={() => setLaciTerbuka(true)}
        />
        {/*
          Tanpa batas lebar. Isinya tabel dan matriks, bukan paragraf — Konsol
          Scan dan Rekap Bulanan justru makin terbaca kalau diberi lebar penuh,
          dan matriks sebulan yang tadinya harus digeser jadi lebih banyak
          muat. Batas 1420px dulu menyisakan ±230px kosong di kanan pada layar
          1885px, menumpuk di satu sisi karena tidak ditengahkan.
        */}
        <main className="w-full min-w-0 p-4 md:p-5">{children}</main>
      </div>
    </div>
  );
}
