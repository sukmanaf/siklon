import { z } from 'zod';

export const skemaLogin = z.object({
  username: z.string().trim().min(1, 'Username wajib diisi').max(50),
  password: z.string().min(1, 'Password wajib diisi').max(200),
});

export const skemaGantiPassword = z
  .object({
    passwordLama: z.string().min(1, 'Password lama wajib diisi'),
    passwordBaru: z
      .string()
      .min(8, 'Password baru minimal 8 karakter')
      .max(200, 'Password terlalu panjang'),
  })
  .refine((v) => v.passwordLama !== v.passwordBaru, {
    message: 'Password baru harus berbeda dari password lama',
    path: ['passwordBaru'],
  });
