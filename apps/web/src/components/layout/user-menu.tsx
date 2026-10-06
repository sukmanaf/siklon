'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRoundIcon, LogOutIcon, MonitorSmartphoneIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useLogout, type Saya } from '@/hooks/use-auth';
import { inisial } from '@/lib/utils';

export function UserMenu({ saya }: { saya: Saya }) {
  const router = useRouter();
  const logout = useLogout();
  const [konfirmasiSemua, setKonfirmasiSemua] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 pr-2.5 pl-1.5">
            <span className="grid size-6 place-items-center rounded-full bg-primary-soft text-[10.5px] font-bold text-primary-ink">
              {inisial(saya.nama)}
            </span>
            <span className="hidden max-w-32 truncate sm:inline">{saya.nama}</span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="font-normal">
            <div className="text-[13px] font-semibold text-foreground">{saya.nama}</div>
            <div className="text-[11.5px]">
              {saya.username} · {saya.peran === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={() => router.push('/ganti-password')}>
            <KeyRoundIcon />
            Ganti password
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setKonfirmasiSemua(true)}>
            <MonitorSmartphoneIcon />
            Keluar dari semua perangkat
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => logout.mutate(false)}>
            <LogOutIcon />
            Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={konfirmasiSemua}
        onOpenChange={setKonfirmasiSemua}
        judul="Keluar dari semua perangkat?"
        deskripsi="Semua sesi Anda dibatalkan, termasuk sesi di komputer gerbang dan perangkat lain yang sedang terbuka. Anda perlu masuk kembali di setiap perangkat."
        labelKonfirmasi="Ya, keluarkan semua"
        berbahaya
        memuat={logout.isPending}
        onKonfirmasi={() => logout.mutate(true)}
      />
    </>
  );
}
