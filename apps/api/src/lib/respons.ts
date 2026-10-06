import type { Response } from 'express';
import type { Halaman, Respons } from '@siklon/shared';

export function kirim<T>(res: Response, data: T, status = 200) {
  const body: Respons<T> = { ok: true, data };
  return res.status(status).json(body);
}

export function kirimHalaman<T>(
  res: Response,
  items: T[],
  total: number,
  page: number,
  perPage: number,
) {
  const data: Halaman<T> = {
    items,
    total,
    page,
    perPage,
    totalPage: perPage > 0 ? Math.ceil(total / perPage) : 0,
  };
  return kirim(res, data);
}

export function kirimError(
  res: Response,
  status: number,
  code: string,
  message: string,
  detail?: unknown,
) {
  const body: Respons<never> = { ok: false, error: { code, message, ...(detail ? { detail } : {}) } };
  return res.status(status).json(body);
}
