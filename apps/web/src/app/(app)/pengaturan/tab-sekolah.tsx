'use client';

import { useEffect, useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import type { Sekolah } from '@siklon/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardHint, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSimpanSetting } from '@/hooks/use-pengaturan';
import { toastGagal, toastSukses } from '@/lib/toast';

export function TabSekolah({ awal }: { awal: Sekolah }) {
  const simpan = useSimpanSetting();
  const [nilai, setNilai] = useState<Sekolah>(awal);

  useEffect(() => setNilai(awal), [awal]);

  const valid = nilai.nama.trim().length > 0;

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Identitas Sekolah</CardTitle>
        <CardHint>dipakai di kepala laporan dan isi pesan WhatsApp</CardHint>
        <Button
          size="sm"
          variant="default"
          className="ml-auto"
          disabled={!valid || simpan.isPending}
          onClick={() =>
            simpan.mutate(
              { kunci: 'sekolah', nilai },
              {
                onSuccess: () => toastSukses('Identitas sekolah disimpan'),
                onError: (e) => toastGagal(e, 'Gagal menyimpan identitas sekolah'),
              },
            )
          }
        >
          {simpan.isPending && <Loader2Icon className="animate-spin" />}
          Simpan
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="nama-sekolah">
            Nama sekolah<span className="ml-0.5 text-destructive">*</span>
          </Label>
          <Input
            id="nama-sekolah"
            value={nilai.nama}
            onChange={(e) => setNilai((n) => ({ ...n, nama: e.target.value }))}
            placeholder="SMP Negeri 1 Contoh"
            aria-invalid={!valid}
          />
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            Nama ini muncul di pesan WhatsApp yang diterima wali murid — tulis seperti yang biasa
            mereka kenal.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="alamat-sekolah">Alamat</Label>
          <Textarea
            id="alamat-sekolah"
            value={nilai.alamat}
            onChange={(e) => setNilai((n) => ({ ...n, alamat: e.target.value }))}
            placeholder="Jl. Pendidikan No. 1, Kecamatan…"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="kepala-sekolah">Kepala sekolah</Label>
          <Input
            id="kepala-sekolah"
            value={nilai.kepala_sekolah}
            onChange={(e) => setNilai((n) => ({ ...n, kepala_sekolah: e.target.value }))}
            placeholder="Drs. Budi Santoso, M.Pd."
          />
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            Dicantumkan sebagai penanda tangan pada laporan yang dicetak.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
