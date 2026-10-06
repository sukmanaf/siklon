'use client';

import * as AlertDialog from '@radix-ui/react-alert-dialog';
import type { ReactNode } from 'react';
import { Loader2Icon } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Konfirmasi untuk tindakan yang sulit dibatalkan (nonaktifkan akun, cabut
 * sesi, reset password).
 *
 * Sengaja memakai AlertDialog, bukan Dialog biasa: fokus terkunci di dalamnya
 * dan klik di luar tidak menutup — pengguna harus benar-benar memilih.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  judul,
  deskripsi,
  labelKonfirmasi = 'Lanjutkan',
  labelBatal = 'Batal',
  berbahaya,
  memuat,
  onKonfirmasi,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  judul: string;
  deskripsi?: ReactNode;
  labelKonfirmasi?: string;
  labelBatal?: string;
  berbahaya?: boolean;
  memuat?: boolean;
  onKonfirmasi: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-5 shadow-2xl data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=open]:fade-in-0">
          <AlertDialog.Title className="text-base font-semibold">{judul}</AlertDialog.Title>
          {deskripsi && (
            <AlertDialog.Description className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              {deskripsi}
            </AlertDialog.Description>
          )}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel
              disabled={memuat}
              className={cn(buttonVariants({ variant: 'outline' }))}
            >
              {labelBatal}
            </AlertDialog.Cancel>
            <button
              type="button"
              disabled={memuat}
              onClick={onKonfirmasi}
              className={cn(
                buttonVariants({ variant: berbahaya ? 'destructive' : 'default' }),
                'disabled:opacity-60',
              )}
            >
              {memuat && <Loader2Icon className="animate-spin" />}
              {labelKonfirmasi}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
