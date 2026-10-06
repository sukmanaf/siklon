import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import type { HasilScan } from '@siklon/shared';
import { corsOrigins } from '../config/env.js';
import { logger } from '../config/logger.js';
import { bacaToken } from '../lib/jwt.js';
import { NAMA_COOKIE } from '../lib/jwt.js';

/** Port terdeteksi yang dilaporkan Scanner Agent. */
export type PortTerdeteksi = {
  path: string;
  serialNumber?: string | null;
  vendorId?: string | null;
  productId?: string | null;
  manufacturer?: string | null;
  locationId?: string | null;
};

type KeluarKeWeb = {
  scan: (hasil: HasilScan) => void;
  wa: (data: { siswaId: string; status: string }) => void;
  'scanner:ports': (data: { agentOnline: boolean; ports: PortTerdeteksi[] }) => void;
  'scanner:identify': (data: { portPath: string; kode?: string | null }) => void;
  'scanner:config': (data: { scanners: unknown[] }) => void;
};

let io: Server<Record<string, never>, KeluarKeWeb> | null = null;

/** Ruang terpisah: konsol scan tidak perlu menerima event khusus agent. */
const RUANG_WEB = 'web';
const RUANG_AGENT = 'agent';

function ambilTokenDariSocket(socket: Socket): string | null {
  const auth = socket.handshake.auth as { token?: string } | undefined;
  if (auth?.token) return auth.token;

  const cookie = socket.handshake.headers.cookie;
  if (!cookie) return null;
  for (const bagian of cookie.split(';')) {
    const [k, ...v] = bagian.trim().split('=');
    if (k === NAMA_COOKIE) return v.join('=');
  }
  return null;
}

export function pasangSocket(server: HttpServer, scannerApiKey: string) {
  io = new Server(server, {
    path: '/socket.io',
    cors: { origin: corsOrigins, credentials: true },
  });

  /**
   * Socket TIDAK boleh terbuka tanpa autentikasi: hasil scan memuat nama,
   * kelas, dan foto siswa. Tanpa penjaga ini, siapa pun yang bisa menjangkau
   * server akan menerima aliran data siswa secara langsung.
   */
  io.use((socket, next) => {
    const apiKey = (socket.handshake.auth as { apiKey?: string } | undefined)?.apiKey;
    if (apiKey && apiKey === scannerApiKey) {
      socket.data['jenis'] = 'agent';
      return next();
    }

    const token = ambilTokenDariSocket(socket);
    const isi = token ? bacaToken(token) : null;
    if (!isi) return next(new Error('Tidak terautentikasi'));

    socket.data['jenis'] = 'web';
    socket.data['userId'] = isi.sub;
    next();
  });

  io.on('connection', (socket) => {
    const jenis = socket.data['jenis'] as 'web' | 'agent';
    void socket.join(jenis === 'agent' ? RUANG_AGENT : RUANG_WEB);
    logger.debug({ jenis, id: socket.id }, 'Socket tersambung');

    socket.on('disconnect', (alasan) => {
      logger.debug({ jenis, alasan }, 'Socket terputus');
    });
  });

  logger.info('Socket.IO siap');
  return io;
}

/** Pengiriman event bersifat "kalau ada yang mendengar" — jangan sampai menggagalkan scan. */
function keWeb<K extends keyof KeluarKeWeb>(event: K, ...args: Parameters<KeluarKeWeb[K]>) {
  if (!io) return;
  try {
    io.to(RUANG_WEB).emit(event, ...args);
  } catch (err) {
    logger.warn({ err, event }, 'Gagal mengirim event socket');
  }
}

export const siarkanScan = (hasil: HasilScan) => keWeb('scan', hasil);
export const siarkanWa = (siswaId: string, status: string) => keWeb('wa', { siswaId, status });
export const siarkanPorts = (agentOnline: boolean, ports: PortTerdeteksi[]) =>
  keWeb('scanner:ports', { agentOnline, ports });
export const siarkanIdentify = (portPath: string, kode?: string | null) =>
  keWeb('scanner:identify', { portPath, kode: kode ?? null });

/** Dorong pemetaan baru ke agent supaya diterapkan tanpa restart. */
export function dorongKonfigKeAgent(scanners: unknown[]) {
  if (!io) return;
  io.to(RUANG_AGENT).emit('scanner:config', { scanners });
}

export const jumlahKlienWeb = () => io?.sockets.adapter.rooms.get(RUANG_WEB)?.size ?? 0;
export const agentTersambung = () => (io?.sockets.adapter.rooms.get(RUANG_AGENT)?.size ?? 0) > 0;
