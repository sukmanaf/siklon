import { toast } from 'sonner';
import { pesanError } from './api';

/**
 * Pembungkus tipis di atas sonner supaya seluruh aplikasi memberi umpan balik
 * dengan gaya yang sama, dan supaya error apa pun — termasuk API mati —
 * selalu diterjemahkan lewat `pesanError`, bukan tampil sebagai "[object Object]".
 */
export const toastSukses = (pesan: string, deskripsi?: string) =>
  toast.success(pesan, { description: deskripsi });

export const toastGagal = (e: unknown, judul = 'Gagal') =>
  toast.error(judul, { description: pesanError(e) });

export const toastInfo = (pesan: string, deskripsi?: string) =>
  toast(pesan, { description: deskripsi });

export { toast };
