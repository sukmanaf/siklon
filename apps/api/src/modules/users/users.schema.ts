import { z } from 'zod';

export const skemaBuatUser = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username minimal 3 karakter')
    .max(50)
    .regex(/^[a-z0-9._-]+$/, 'Username hanya boleh huruf kecil, angka, titik, garis bawah, dan strip'),
  full_name: z.string().trim().min(1, 'Nama lengkap wajib diisi').max(120),
  password: z.string().min(8, 'Password minimal 8 karakter').max(200),
  // Peran sengaja TIDAK diterima dari klien. Akun yang dibuat lewat web
  // selalu ADMIN; Super Admin hanya bisa dibuat lewat CLI di server.
});

export const skemaUbahUser = z.object({
  full_name: z.string().trim().min(1).max(120).optional(),
  is_active: z.boolean().optional(),
});

export const skemaResetPassword = z.object({
  passwordBaru: z.string().min(8, 'Password minimal 8 karakter').max(200),
});
