import pino from 'pino';
import { env, isDev } from './env.js';

/**
 * Daftar field yang isinya TIDAK BOLEH pernah masuk log.
 * Termasuk nomor WA wali murid — itu data pribadi menurut UU PDP.
 */
const REDACT = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  'password',
  'passwordBaru',
  'passwordLama',
  'password_hash',
  'token',
  'accessToken',
  'phone',
  'phone_wa',
  '*.password',
  '*.phone_wa',
];

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : isDev ? 'debug' : 'info',
  redact: { paths: REDACT, censor: '[disensor]' },
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
    : {}),
});
