import type { RequestHandler } from 'express';

/**
 * Express 5 sudah meneruskan promise yang reject ke error handler,
 * tapi pembungkus ini membuat maksudnya eksplisit dan tipenya rapi.
 */
export const ah =
  <T extends RequestHandler>(fn: T): RequestHandler =>
  (req, res, next) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
