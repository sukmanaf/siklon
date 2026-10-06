'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatNomor } from '@siklon/shared';
import { Loader2Icon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { FormField } from '@/components/form-field';
import { useBuatSiswa, useUbahSiswa } from '@/hooks/use-siswa';
import { useDaftarKelas } from '@/hooks/use-kelas';
import { toastGagal, toastSukses } from '@/lib/toast';
import type { Siswa } from '@/lib/tipe';

/** Nilai khusus untuk "tidak ada kelas" — Radix Select melarang value string kosong. */
const TANPA_KELAS = '__tanpa__';

// Disamakan dengan skemaSiswa di apps/api/src/modules/siswa/siswa.routes.ts.
const skema = z.object({
  nis: z
    .string()
    .trim()
    .min(1, 'NIS wajib diisi')
    .max(20)
    .regex(/^[A-Za-z0-9]+$/, 'NIS hanya boleh huruf dan angka'),
  full_name: z.string().trim().min(1, 'Nama siswa wajib diisi').max(120),
  class_id: z.string(),
  // Nomor divalidasi longgar di sini (server yang menormalkan ke E.164).
  // Yang penting formulir tidak menolak "0812-3456-7890" yang sah.
  guardian_phone: z
    .string()
    .trim()
    .max(25)
    .refine((v) => v === '' || /^[\d+\-\s().]{8,25}$/.test(v), 'Nomor HP tidak valid')
    .optional(),
});
type Nilai = z.infer<typeof skema>;

export function DialogSiswa({
  buka,
  siswa,
  onTutup,
}: {
  buka: boolean;
  /** null = tambah baru. */
  siswa: Siswa | null;
  onTutup: () => void;
}) {
  const kelas = useDaftarKelas();
  const buat = useBuatSiswa();
  const ubah = useUbahSiswa();
  const [notify, setNotify] = useState(true);

  const { control, handleSubmit, reset, setValue, watch } = useForm<Nilai>({
    resolver: zodResolver(skema),
    defaultValues: {
      nis: '',
      full_name: '',
      class_id: TANPA_KELAS,
      guardian_phone: '',
    },
  });

  // Isi ulang formulir tiap kali dialog dibuka untuk siswa yang berbeda.
  useEffect(() => {
    if (!buka) return;
    reset({
      nis: siswa?.nis ?? '',
      full_name: siswa?.full_name ?? '',
      class_id: siswa?.classes?.id ?? TANPA_KELAS,
      guardian_phone: siswa?.guardian_phone ? formatNomor(siswa.guardian_phone) : '',
    });
    setNotify(siswa?.notify ?? true);
  }, [buka, siswa, reset]);

  const sedangSimpan = buat.isPending || ubah.isPending;

  function kirim(nilai: Nilai) {
    const data = {
      nis: nilai.nis,
      full_name: nilai.full_name,
      class_id: nilai.class_id === TANPA_KELAS ? null : nilai.class_id,
      guardian_phone: nilai.guardian_phone?.trim() ? nilai.guardian_phone.trim() : null,
      notify,
    };

    const opsi = {
      onSuccess: () => {
        toastSukses(siswa ? 'Data siswa diperbarui' : `Siswa ${data.full_name} ditambahkan`);
        onTutup();
      },
      onError: (e: unknown) => toastGagal(e, 'Data siswa gagal disimpan'),
    };

    if (siswa) ubah.mutate({ id: siswa.id, ...data }, opsi);
    else buat.mutate(data, opsi);
  }

  const kelasTerpilih = watch('class_id');

  return (
    <Dialog open={buka} onOpenChange={(o) => !o && onTutup()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{siswa ? 'Ubah data siswa' : 'Tambah siswa'}</DialogTitle>
          <DialogDescription>
            NIS adalah isi QR pada kartu siswa — pastikan sama persis dengan yang tercetak di
            kartunya.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(kirim)} noValidate className="space-y-4">
          <FormField control={control} name="full_name" label="Nama lengkap" wajib>
            {({ id, field, invalid, ...a }) => (
              <Input id={id} autoFocus aria-invalid={invalid} {...a} {...field} />
            )}
          </FormField>

          <FormField
            control={control}
            name="nis"
            label="NIS"
            deskripsi="Huruf dan angka saja. Inilah yang dicetak sebagai QR di kartu."
            wajib
          >
            {({ id, field, invalid, ...a }) => (
              <Input id={id} className="font-mono" spellCheck={false} aria-invalid={invalid} {...a} {...field} />
            )}
          </FormField>

          <div className="space-y-1.5">
            <Label htmlFor="kelas-siswa">Kelas</Label>
            <Select
              value={kelasTerpilih}
              onValueChange={(v) => setValue('class_id', v, { shouldDirty: true })}
            >
              <SelectTrigger id="kelas-siswa">
                <SelectValue placeholder="Pilih kelas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TANPA_KELAS}>— Belum ada kelas —</SelectItem>
                {kelas.data?.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              Siswa tanpa kelas tidak muncul di laporan kelas mana pun.
            </p>
          </div>

          <div>
            <FormField
              control={control}
              name="guardian_phone"
              label="No. HP wali"
              deskripsi="Format apa pun boleh; server menyeragamkannya."
            >
              {({ id, field, invalid, ...a }) => (
                <Input
                  id={id}
                  inputMode="tel"
                  className="font-mono"
                  placeholder="081234567890"
                  aria-invalid={invalid}
                  {...a}
                  {...field}
                  value={field.value ?? ''}
                />
              )}
            </FormField>
          </div>
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            Nomor tujuan notifikasi WhatsApp. Tanpa nomor, kedatangan anak ini tidak dikabarkan
            ke siapa pun. Kakak-adik memang memakai nomor yang sama — itu bukan data dobel.
          </p>

          {/*
            Satu-satunya tempat notifikasi bisa dinyalakan lagi. Balasan
            "BERHENTI" dari wali mematikannya lewat backend; tanpa saklar ini
            tidak ada jalan kembali dari aplikasi.
          */}
          <div className="flex items-start gap-3 rounded-lg border border-border p-3">
            <Switch id="notify-siswa" checked={notify} onCheckedChange={setNotify} />
            <div>
              <Label htmlFor="notify-siswa" className="text-[13px] text-foreground">
                Kirimi notifikasi WhatsApp
              </Label>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                Matikan hanya bila wali sendiri yang meminta berhenti.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" onClick={onTutup} disabled={sedangSimpan}>
              Batal
            </Button>
            <Button type="submit" variant="default" disabled={sedangSimpan}>
              {sedangSimpan && <Loader2Icon className="animate-spin" />}
              {siswa ? 'Simpan perubahan' : 'Tambah siswa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
