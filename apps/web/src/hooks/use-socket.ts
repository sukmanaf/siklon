'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { URL_API } from '@/lib/api';

/** Server memasang Socket.IO di root, bukan di bawah /api/v1. */
const URL_SOCKET = URL_API.replace(/\/api\/v\d+\/?$/, '');

export type StatusSambungan = 'menyambung' | 'tersambung' | 'terputus';

export type PortTerdeteksi = {
  path: string;
  serialNumber?: string | null;
  vendorId?: string | null;
  productId?: string | null;
  manufacturer?: string | null;
  locationId?: string | null;
};

type Pendengar = {
  onScan?: (hasil: unknown) => void;
  onPorts?: (data: { agentOnline: boolean; ports: PortTerdeteksi[] }) => void;
  onIdentify?: (data: { portPath: string; kode: string | null }) => void;
};

/**
 * Satu sambungan Socket.IO untuk halaman yang membutuhkannya.
 *
 * Autentikasinya memakai cookie sesi yang sama dengan REST (`withCredentials`),
 * jadi tidak ada token yang perlu dititipkan ke JavaScript. Socket.IO sudah
 * menyambung ulang sendiri; yang ditambahkan di sini hanyalah status yang bisa
 * ditampilkan ke petugas gerbang — layar yang diam tanpa kabar jauh lebih
 * berbahaya daripada layar yang bilang "terputus" (FE-023).
 */
export function useSocket(pendengar: Pendengar, aktif = true) {
  const [status, setStatus] = useState<StatusSambungan>('menyambung');
  const [percobaan, setPercobaan] = useState(0);
  const [alasan, setAlasan] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Pendengar disimpan di ref supaya sambungan tidak dibongkar-pasang setiap
  // komponen render ulang (fungsi callback beridentitas baru tiap render).
  const ref = useRef(pendengar);
  useEffect(() => {
    ref.current = pendengar;
  });

  useEffect(() => {
    if (!aktif) return;

    const socket = io(URL_SOCKET, {
      withCredentials: true,
      path: '/socket.io',
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('tersambung');
      setPercobaan(0);
      setAlasan(null);
    });
    socket.on('disconnect', (r) => {
      setStatus('terputus');
      setAlasan(r);
    });
    socket.on('connect_error', (e) => {
      setStatus('terputus');
      setAlasan(e.message);
    });
    socket.io.on('reconnect_attempt', (n) => {
      setStatus('menyambung');
      setPercobaan(n);
    });

    socket.on('scan', (h) => ref.current.onScan?.(h));
    socket.on('scanner:ports', (d) => ref.current.onPorts?.(d));
    socket.on('scanner:identify', (d) => ref.current.onIdentify?.(d));

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [aktif]);

  return { status, percobaan, alasan, socket: socketRef.current };
}
