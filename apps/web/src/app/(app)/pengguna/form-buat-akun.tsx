'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DicesIcon, Loader2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/form-field';
import { acakPassword, useBuatPengguna } from '@/hooks/use-pengguna';
import { toastGagal, toastSukses } from '@/lib/toast';

// Dicocokkan dengan skemaBuatUser di backend supaya pesan salahnya muncul
// sebelum permintaan dikirim, bukan sesudah ditolak server.
const skema = z.object({
  full_name: z.string().trim().min(1, 'Nama lengkap wajib diisi').max(120),
  username: z
    .string()
    .trim()
    .min(3, 'Username minimal 3 karakter')
    .max(50)
    .regex(
      /^[a-z0-9._-]+$/,
      'Hanya huruf kecil, angka, titik, garis bawah, dan strip',
    ),
  password: z.string().min(8, 'Password minimal 8 karakter').max(200),
});
type Nilai = z.infer<typeof skema>;

export function FormBuatAkun() {
  const buat = useBuatPengguna();
  const { control, handleSubmit, reset, setValue, watch } = useForm<Nilai>({
    resolver: zodResolver(skema),
    defaultValues: { full_name: '', username: '', password: '' },
  });

  const password = watch('password');

  function kirim(nilai: Nilai) {
    buat.mutate(nilai, {
      onSuccess: (p) => {
        toastSukses(
          `Akun ${p.username} dibuat`,
          `Berikan password sementara "${nilai.password}" kepada yang bersangkutan. Ia wajib menggantinya saat masuk pertama kali.`,
        );
        reset();
      },
      onError: (e) => toastGagal(e, 'Akun gagal dibuat'),
    });
  }

  return (
    // Saat formulir turun ke bawah tabel, lebarnya dibatasi supaya kolom isian
    // tidak melar sepanjang layar.
    <Card className="w-full max-w-xl self-start 2xl:max-w-none">
      <CardHeader>
        <CardTitle>Buat Akun Admin</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(kirim)} noValidate className="space-y-4">
          <FormField control={control} name="full_name" label="Nama Lengkap" wajib>
            {({ id, field, invalid, ...a }) => (
              <Input id={id} placeholder="mis. Siti Nurhaliza" aria-invalid={invalid} {...a} {...field} />
            )}
          </FormField>

          <FormField
            control={control}
            name="username"
            label="Username"
            deskripsi="Dipakai untuk masuk. Tidak bisa diubah setelah akun dibuat."
            wajib
          >
            {({ id, field, invalid, ...a }) => (
              <Input
                id={id}
                placeholder="mis. siti.n"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={invalid}
                {...a}
                {...field}
              />
            )}
          </FormField>

          <FormField
            control={control}
            name="password"
            label="Password Sementara"
            deskripsi="Catat dan sampaikan ke pemilik akun. Sistem akan memaksanya mengganti password saat masuk pertama kali."
            wajib
          >
            {({ id, field, invalid, ...a }) => (
              <div className="flex gap-2">
                <Input
                  id={id}
                  className="flex-1 font-mono"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={invalid}
                  {...a}
                  {...field}
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-9 px-3"
                  onClick={() => setValue('password', acakPassword(), { shouldValidate: true })}
                >
                  <DicesIcon />
                  Acak
                </Button>
              </div>
            )}
          </FormField>

          <div>
            <p className="text-xs font-semibold text-muted-foreground">Peran</p>
            <div className="mt-1.5 rounded-md border border-input bg-surface-2 px-3 py-2 text-[13px] text-muted-foreground">
              Admin
            </div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
              Peran dikunci ke Admin — backend menolak peran yang dititipkan dari browser.
              Menambah Super Admin hanya lewat CLI di server:
              <br />
              <code className="font-mono text-[11px]">
                pnpm --filter @siklon/api user:promote &lt;username&gt;
              </code>
            </p>
          </div>

          <Button
            type="submit"
            variant="default"
            className="w-full"
            disabled={buat.isPending || !password}
          >
            {buat.isPending && <Loader2Icon className="animate-spin" />}
            Buat Akun
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
