'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { CircleAlertIcon, InfoIcon, Loader2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/form-field';
import { PasswordInput } from '@/components/password-input';
import { useLogin } from '@/hooks/use-auth';
import { pesanError } from '@/lib/api';

const skema = z.object({
  username: z.string().trim().min(1, 'Username wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi'),
});
type Nilai = z.infer<typeof skema>;

/**
 * Tujuan setelah masuk. Hanya path internal yang diterima — nilai `next`
 * datang dari URL, dan menerimanya mentah-mentah membuka pengalihan ke situs
 * lain (open redirect) yang bisa dipakai untuk halaman login palsu.
 */
function tujuanAman(next: string | null): string {
  if (!next) return '/dashboard';
  if (!next.startsWith('/') || next.startsWith('//')) return '/dashboard';
  if (next.startsWith('/login')) return '/dashboard';
  return next;
}

export function FormLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useLogin();

  const { control, handleSubmit } = useForm<Nilai>({
    resolver: zodResolver(skema),
    defaultValues: { username: '', password: '' },
  });

  /*
   * Tombol Masuk baru hidup setelah React terpasang di halaman.
   *
   * Sebelum hidrasi, `onSubmit` belum terikat, jadi menekan tombol (atau Enter)
   * menjalankan pengiriman form bawaan browser — dan form tanpa `action`
   * dikirim sebagai GET ke URL yang sama, sehingga PASSWORD-nya mendarat di
   * query string: tercatat di riwayat browser, di bilah alamat, dan di log
   * server. Itu benar-benar terjadi dan terlihat di log dev:
   *
   *   GET /login?username=superadmin&password=...
   *
   * Tombol submit yang disabled juga menutup jalur Enter, karena pengiriman
   * implisit butuh tombol submit yang aktif. Jendelanya memang sempit — hanya
   * sampai skripnya selesai dimuat — tapi justru di situlah pengguna yang tidak
   * sabar di laptop sekolah yang lambat menekan Enter.
   */
  const [siap, setSiap] = useState(false);
  useEffect(() => setSiap(true), []);

  function kirim(nilai: Nilai) {
    login.mutate(nilai, {
      onSuccess: ({ user }) => {
        // Akun yang belum pernah ganti password tidak boleh mendarat di
        // halaman lain dulu (FE-009).
        const tujuan = user.wajibGantiPassword
          ? '/ganti-password'
          : tujuanAman(params.get('next'));
        router.replace(tujuan);
        // Cookie baru harus terbaca middleware pada navigasi berikutnya.
        router.refresh();
      },
    });
  }

  return (
    // method="post" adalah pengaman berlapis: seandainya ada pengiriman bawaan
    // yang lolos, isinya tidak akan pernah jadi query string.
    <form method="post" onSubmit={handleSubmit(kirim)} noValidate>
      <h2 className="text-xl font-semibold">Masuk</h2>
      <p className="mt-1.5 mb-6 text-[13px] text-muted-foreground">
        Gunakan akun yang diberikan administrator sekolah.
      </p>

      {/*
        Mendarat di sini tanpa penjelasan membingungkan: pengguna merasa sudah
        masuk, lalu tiba-tiba diminta masuk lagi. Sebutkan sebabnya.
      */}
      {params.get('sesi') === 'habis' && !login.isError && (
        <div
          role="status"
          className="mb-4 flex items-start gap-2 rounded-lg bg-terlambat-bg px-3.5 py-2.5 text-[12.5px] leading-relaxed font-medium text-terlambat"
        >
          <InfoIcon className="mt-px size-4 shrink-0" />
          <span>
            Sesi Anda sudah berakhir — bisa karena password diganti di perangkat lain, akun
            dinonaktifkan, atau sesinya kedaluwarsa. Silakan masuk lagi.
          </span>
        </div>
      )}

      {login.isError && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-lg bg-alpa-bg px-3.5 py-2.5 text-[12.5px] leading-relaxed font-medium text-alpa"
        >
          <CircleAlertIcon className="mt-px size-4 shrink-0" />
          {/*
            Pesannya datang apa adanya dari backend, yang sengaja menjawab
            sama untuk username tidak terdaftar maupun password salah (FE-007).
            Jangan pernah menambahkan pembedaan di sisi ini.
          */}
          <span>{pesanError(login.error)}</span>
        </div>
      )}

      <div className="space-y-4">
        <FormField control={control} name="username" label="Username">
          {({ id, field, invalid, ...a }) => (
            <Input
              id={id}
              autoComplete="username"
              autoFocus
              placeholder="nama pengguna"
              aria-invalid={invalid}
              {...a}
              {...field}
            />
          )}
        </FormField>

        <FormField control={control} name="password" label="Password">
          {({ id, field, invalid, ...a }) => (
            <PasswordInput
              id={id}
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={invalid}
              {...a}
              {...field}
            />
          )}
        </FormField>
      </div>

      <Button
        type="submit"
        variant="default"
        size="lg"
        className="mt-6 w-full"
        disabled={login.isPending || !siap}
      >
        {login.isPending && <Loader2Icon className="animate-spin" />}
        {login.isPending ? 'Memeriksa…' : 'Masuk'}
      </Button>

      <div className="mt-6 rounded-lg border border-primary/20 bg-primary-soft px-3.5 py-3 text-[12.5px] leading-relaxed text-primary-ink">
        <b className="font-bold">Keamanan:</b> 5× gagal masuk mengunci percobaan selama 15 menit.
        Password wajib diganti saat pertama kali masuk. Lupa password? Hubungi Super Admin sekolah
        untuk mereset akun Anda.
      </div>
    </form>
  );
}
