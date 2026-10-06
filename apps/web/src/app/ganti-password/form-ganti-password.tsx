'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { ArrowLeftIcon, CircleAlertIcon, Loader2Icon, LockKeyholeIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FormField } from '@/components/form-field';
import { PasswordInput } from '@/components/password-input';
import { useGantiPassword, useSaya } from '@/hooks/use-auth';
import { pesanError } from '@/lib/api';
import { toastSukses } from '@/lib/toast';

const skema = z
  .object({
    passwordLama: z.string().min(1, 'Password lama wajib diisi'),
    passwordBaru: z.string().min(8, 'Password baru minimal 8 karakter'),
    konfirmasi: z.string().min(1, 'Ulangi password baru'),
  })
  .refine((v) => v.passwordBaru !== v.passwordLama, {
    message: 'Password baru harus berbeda dari password lama',
    path: ['passwordBaru'],
  })
  .refine((v) => v.passwordBaru === v.konfirmasi, {
    message: 'Konfirmasi tidak sama dengan password baru',
    path: ['konfirmasi'],
  });
type Nilai = z.infer<typeof skema>;

/**
 * Satu layar untuk dua keadaan:
 *  - FE-009 wajib: pengguna baru / password yang baru direset admin. Tidak ada
 *    jalan keluar dari halaman ini selain mengganti password.
 *  - FE-010 sukarela: dibuka sendiri dari menu profil, ada tombol kembali.
 */
export function FormGantiPassword() {
  const router = useRouter();
  const { data: saya, isPending, isError, error } = useSaya();
  const ganti = useGantiPassword();

  const { control, handleSubmit } = useForm<Nilai>({
    resolver: zodResolver(skema),
    defaultValues: { passwordLama: '', passwordBaru: '', konfirmasi: '' },
  });

  if (isPending) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-8">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="space-y-3 p-8 text-center">
          <p className="text-sm font-semibold">Tidak bisa memuat profil Anda</p>
          <p className="text-[13px] text-muted-foreground">{pesanError(error)}</p>
          <Button onClick={() => router.refresh()}>Coba lagi</Button>
        </CardContent>
      </Card>
    );
  }

  const wajib = saya.wajibGantiPassword;

  function kirim(nilai: Nilai) {
    ganti.mutate(
      { passwordLama: nilai.passwordLama, passwordBaru: nilai.passwordBaru },
      {
        onSuccess: () => {
          toastSukses(
            'Password berhasil diganti',
            'Sesi di perangkat lain ikut dikeluarkan demi keamanan.',
          );
          router.replace('/dashboard');
          router.refresh();
        },
      },
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardContent className="p-8">
        <div className="mb-5 flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-ink">
            <LockKeyholeIcon className="size-4" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">
              {wajib ? 'Ganti password dulu' : 'Ganti password'}
            </h1>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              {wajib
                ? 'Akun Anda masih memakai password sementara dari administrator. Ganti dulu sebelum memakai fitur lain.'
                : 'Password baru minimal 8 karakter dan harus berbeda dari yang lama.'}
            </p>
          </div>
        </div>

        {ganti.isError && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-lg bg-alpa-bg px-3.5 py-2.5 text-[12.5px] leading-relaxed font-medium text-alpa"
          >
            <CircleAlertIcon className="mt-px size-4 shrink-0" />
            <span>{pesanError(ganti.error)}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(kirim)} noValidate className="space-y-4">
          <FormField control={control} name="passwordLama" label="Password saat ini" wajib>
            {({ id, field, invalid, ...a }) => (
              <PasswordInput
                id={id}
                autoComplete="current-password"
                autoFocus
                aria-invalid={invalid}
                {...a}
                {...field}
              />
            )}
          </FormField>

          <FormField
            control={control}
            name="passwordBaru"
            label="Password baru"
            deskripsi="Minimal 8 karakter."
            wajib
          >
            {({ id, field, invalid, ...a }) => (
              <PasswordInput
                id={id}
                autoComplete="new-password"
                aria-invalid={invalid}
                {...a}
                {...field}
              />
            )}
          </FormField>

          <FormField control={control} name="konfirmasi" label="Ulangi password baru" wajib>
            {({ id, field, invalid, ...a }) => (
              <PasswordInput
                id={id}
                autoComplete="new-password"
                aria-invalid={invalid}
                {...a}
                {...field}
              />
            )}
          </FormField>

          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" variant="default" disabled={ganti.isPending} className="flex-1">
              {ganti.isPending && <Loader2Icon className="animate-spin" />}
              Simpan password baru
            </Button>
            {/* Tombol kembali sengaja tidak ada saat wajib ganti password. */}
            {!wajib && (
              <Button asChild variant="outline">
                <Link href="/dashboard">
                  <ArrowLeftIcon />
                  Kembali
                </Link>
              </Button>
            )}
          </div>
        </form>

        <p className="mt-5 text-[11.5px] leading-relaxed text-muted-foreground">
          Setelah diganti, semua sesi lama dibatalkan — termasuk di perangkat lain.
        </p>
      </CardContent>
    </Card>
  );
}
