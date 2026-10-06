'use client';

import { useEffect, useState } from 'react';
import { DicesIcon, Loader2Icon } from 'lucide-react';
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
import {
  acakPassword,
  useResetPasswordPengguna,
  useUbahPengguna,
  type Pengguna,
} from '@/hooks/use-pengguna';
import { toastGagal, toastSukses } from '@/lib/toast';

export function DialogEditNama({
  pengguna,
  onTutup,
}: {
  pengguna: Pengguna | null;
  onTutup: () => void;
}) {
  const ubah = useUbahPengguna();
  const [nama, setNama] = useState('');

  useEffect(() => setNama(pengguna?.full_name ?? ''), [pengguna]);

  const valid = nama.trim().length > 0 && nama.trim().length <= 120;

  return (
    <Dialog open={Boolean(pengguna)} onOpenChange={(o) => !o && onTutup()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ubah nama pengguna</DialogTitle>
          <DialogDescription>
            Username <span className="num">{pengguna?.username}</span> tidak bisa diubah — hanya
            nama tampilannya.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="nama-pengguna">Nama lengkap</Label>
          <Input
            id="nama-pengguna"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            maxLength={120}
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button onClick={onTutup} disabled={ubah.isPending}>
            Batal
          </Button>
          <Button
            variant="default"
            disabled={!valid || ubah.isPending}
            onClick={() =>
              pengguna &&
              ubah.mutate(
                { id: pengguna.id, full_name: nama.trim() },
                {
                  onSuccess: () => {
                    toastSukses('Nama diperbarui');
                    onTutup();
                  },
                  onError: (e) => toastGagal(e, 'Gagal memperbarui nama'),
                },
              )
            }
          >
            {ubah.isPending && <Loader2Icon className="animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DialogResetPassword({
  pengguna,
  onTutup,
}: {
  pengguna: Pengguna | null;
  onTutup: () => void;
}) {
  const reset = useResetPasswordPengguna();
  const [password, setPassword] = useState('');

  // Password baru diacak begitu dialog terbuka, supaya admin tidak tergoda
  // memakai password yang gampang ditebak.
  useEffect(() => {
    if (pengguna) setPassword(acakPassword());
  }, [pengguna]);

  return (
    <Dialog open={Boolean(pengguna)} onOpenChange={(o) => !o && onTutup()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password {pengguna?.full_name}</DialogTitle>
          <DialogDescription>
            Semua sesi aktif pengguna ini akan dicabut, dan ia wajib mengganti password saat masuk
            berikutnya. Catat password di bawah dan sampaikan langsung kepadanya.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="password-baru">Password sementara</Label>
          <div className="flex gap-2">
            <Input
              id="password-baru"
              className="flex-1 font-mono"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
            <Button type="button" size="sm" className="h-9 px-3" onClick={() => setPassword(acakPassword())}>
              <DicesIcon />
              Acak
            </Button>
          </div>
          {password.length > 0 && password.length < 8 && (
            <p className="text-[11.5px] font-medium text-destructive">Minimal 8 karakter</p>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onTutup} disabled={reset.isPending}>
            Batal
          </Button>
          <Button
            variant="destructive"
            disabled={password.length < 8 || reset.isPending}
            onClick={() =>
              pengguna &&
              reset.mutate(
                { id: pengguna.id, passwordBaru: password },
                {
                  onSuccess: () => {
                    toastSukses(
                      'Password direset',
                      `Sampaikan password "${password}" kepada ${pengguna.full_name}.`,
                    );
                    onTutup();
                  },
                  onError: (e) => toastGagal(e, 'Gagal mereset password'),
                },
              )
            }
          >
            {reset.isPending && <Loader2Icon className="animate-spin" />}
            Reset password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
