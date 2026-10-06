import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { corsOrigins, isDev } from './config/env.js';
import { logger } from './config/logger.js';
import { apiRouter } from './routes.js';
import { errorHandler, notFoundHandler } from './middlewares/error.js';

export function buatApp() {
  const app = express();

  // Di belakang Caddy/nginx: percayai satu proxy agar IP klien terbaca benar
  // (penting untuk rate limit login dan pencatatan last_login_ip).
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Kolom BIGSERIAL (attendance.id, wa_messages.id) dipetakan Prisma ke BigInt,
  // dan JSON.stringify MELEMPAR pada BigInt. Tanpa replacer ini, setiap respons
  // yang memuat id presensi akan jadi 500. Dikirim sebagai string agar aman dari
  // kehilangan presisi di klien JavaScript.
  app.set('json replacer', (_kunci: string, nilai: unknown) =>
    typeof nilai === 'bigint' ? nilai.toString() : nilai,
  );

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => {
        // Permintaan tanpa Origin (Scanner Agent, curl, health check) tetap dilayani.
        if (!origin || isDev || corsOrigins.includes(origin)) return cb(null, true);
        if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || origin.startsWith('http://192.168.')) {
          return cb(null, true);
        }
        logger.warn({ origin }, 'Permintaan dari origin yang tidak diizinkan');
        cb(null, false);
      },
      credentials: true,
    }),
  );

  app.use(
    pinoHttp({
      logger,
      // Health check tiap beberapa detik akan membanjiri log tanpa guna.
      autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
      customLogLevel: (_req, res, err) =>
        err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
    }),
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use('/api/v1', apiRouter);

  if (isDev) {
    app.get('/', (_req, res) => {
      res.json({ nama: 'SIKLON API', dokumentasi: 'docs/PLAN.md', health: '/api/v1/health' });
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
