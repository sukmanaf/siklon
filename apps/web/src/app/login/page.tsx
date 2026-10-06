import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FormLogin } from './form-login';

export const metadata: Metadata = { title: 'Masuk' };

const KEUNGGULAN = [
  { ikon: '⚡', teks: 'Multi-scanner dalam 1 PC' },
  { ikon: '💬', teks: 'Notifikasi WhatsApp otomatis' },
  { ikon: '📊', teks: 'Laporan harian & bulanan' },
];

export default function HalamanLogin() {
  return (
    <div
      className="grid min-h-screen place-items-center p-4"
      style={{ background: 'radial-gradient(1200px 600px at 20% 0%, #1e1b4b, #020617)' }}
    >
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,.5)] md:grid-cols-[1.1fr_1fr]">
        <div className="hidden flex-col bg-gradient-to-br from-indigo-700 to-cyan-700 p-11 text-white md:flex">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-white/20 font-extrabold">
              PS
            </div>
            <div>
              <b className="text-lg">PresenSee</b>
              <div className="text-[11px] tracking-widest opacity-75">SISTEM PRESENSI SISWA</div>
            </div>
          </div>

          <h2 className="mt-11 text-[27px] leading-snug font-bold">
            Presensi cepat,
            <br />
            orang tua langsung tahu.
          </h2>
          <p className="mt-3.5 max-w-[330px] text-[13.5px] leading-relaxed opacity-85">
            Scan barcode kartu siswa di beberapa gerbang sekaligus. Notifikasi WhatsApp terkirim
            otomatis ke wali murid dalam hitungan detik.
          </p>

          <div className="mt-10 grid gap-3 text-[13px]">
            {KEUNGGULAN.map((k) => (
              <div key={k.teks} className="flex items-center gap-2.5">
                <span aria-hidden>{k.ikon}</span> {k.teks}
              </div>
            ))}
          </div>

          <div className="mt-auto pt-12 text-[11px] opacity-60">PresenSee v1.0</div>
        </div>

        <div className="bg-card p-8 sm:p-11">
          <Suspense fallback={null}>
            <FormLogin />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
