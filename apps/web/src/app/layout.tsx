import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { ScriptTema } from '@/components/layout/script-tema';

export const metadata: Metadata = {
  title: { default: 'PresenSee — Presensi Siswa', template: '%s · PresenSee' },
  description: 'Sistem presensi siswa dengan notifikasi WhatsApp ke wali murid.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Warna bar browser mengikuti latar aplikasi di masing-masing tema.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f1f5f9' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1120' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: atribut data-theme dipasang skrip di <head>
    // sebelum React sempat berjalan, jadi HTML server dan klien memang beda.
    <html lang="id" suppressHydrationWarning>
      <head>
        <ScriptTema />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
