import { Router } from 'express';
import { healthRouter } from './modules/health/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { settingsRouter } from './modules/settings/settings.routes.js';
import { kelasRouter, tahunAjaranRouter } from './modules/akademik/akademik.routes.js';
import { liburRouter } from './modules/akademik/libur.routes.js';
import { siswaRouter } from './modules/siswa/siswa.routes.js';
import { fotoRouter } from './modules/siswa/foto.routes.js';
import { presensiRouter, scanRouter, scannerRouter } from './modules/presensi/presensi.routes.js';
import { waRouter } from './modules/whatsapp/wa.routes.js';
import { dashboardRouter, laporanRouter } from './modules/laporan/laporan.routes.js';

/** Semua rute API berada di bawah /api/v1. */
export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use('/auth', authRouter);

// Scanner Agent memakai X-Api-Key, bukan JWT — didaftarkan sebelum modul
// ber-JWT agar tidak ikut terkena penjaga sesi pengguna.
apiRouter.use(scanRouter);

// Catatan: penegakan "wajib ganti password" TIDAK dipasang di sini. Ia bergantung
// pada req.user, jadi harus berjalan sesudah autentikasi — dipasang per modul
// lewat `wajibMasukPenuh`.

apiRouter.use('/users', usersRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/academic-years', tahunAjaranRouter);
apiRouter.use('/classes', kelasRouter);
apiRouter.use('/holidays', liburRouter);
apiRouter.use('/students', fotoRouter);
apiRouter.use('/students', siswaRouter);
apiRouter.use('/attendance', presensiRouter);
apiRouter.use('/scanners', scannerRouter);
apiRouter.use('/wa', waRouter);
apiRouter.use('/reports', laporanRouter);
apiRouter.use('/dashboard', dashboardRouter);
