'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Peran } from '@siklon/shared';
import { navigasiUntuk } from '@/lib/navigasi';
import { cn, inisial } from '@/lib/utils';

export function Sidebar({
  peran,
  nama,
  onPilih,
}: {
  peran: Peran | undefined;
  nama: string;
  /** Dipanggil setelah menu diklik — dipakai menutup laci di layar kecil. */
  onPilih?: () => void;
}) {
  const pathname = usePathname();
  const grup = navigasiUntuk(peran);

  return (
    <aside className="flex h-full flex-col gap-0.5 overflow-y-auto bg-sidebar px-2.5 py-3.5 text-sidebar-ink">
      <div className="flex items-center gap-2.5 px-2.5 pt-2 pb-4">
        <div className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-gradient-to-br from-indigo-500 to-cyan-400 text-sm font-extrabold text-white">
          PS
        </div>
        <div>
          <b className="text-[15px] tracking-wide text-white">PresenSee</b>
          <small className="block text-[10.5px] font-medium tracking-widest text-slate-500">
            PRESENSI SISWA
          </small>
        </div>
      </div>

      {grup.map((g) => (
        <div key={g.judul}>
          <div className="px-3 pt-3.5 pb-1.5 text-[10px] font-bold tracking-[0.09em] text-sidebar-label uppercase">
            {g.judul}
          </div>
          {g.item.map(({ href, label, Ikon, pil, siap }) => {
            const aktif = pathname === href || pathname.startsWith(`${href}/`);
            const isi = (
              <>
                <Ikon className="size-4 shrink-0 opacity-90" />
                <span className="truncate">{label}</span>
                {pil && (
                  <span
                    className={cn(
                      'ml-auto rounded-full px-1.5 py-px text-[10px] font-bold text-white',
                      pil.gaya === 'merah' ? 'bg-red-600' : 'bg-indigo-600',
                    )}
                  >
                    {pil.teks}
                  </span>
                )}
              </>
            );

            if (!siap) {
              return (
                <span
                  key={href}
                  title="Belum tersedia — menunggu modul backend-nya selesai"
                  aria-disabled
                  className="flex w-full cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] opacity-40"
                >
                  {isi}
                </span>
              );
            }

            return (
              <Link
                key={href}
                href={href}
                onClick={onPilih}
                aria-current={aktif ? 'page' : undefined}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors',
                  aktif
                    ? 'bg-primary font-semibold text-white'
                    : 'hover:bg-sidebar-active hover:text-white',
                )}
              >
                {isi}
              </Link>
            );
          })}
        </div>
      ))}

      <div className="mt-auto flex items-center gap-2.5 border-t border-slate-800 px-2.5 pt-3">
        <div className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-[11.5px] font-bold text-white">
          {inisial(nama)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-semibold text-slate-200">{nama}</div>
          <div className="text-[10.5px] text-slate-500">
            {peran === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
          </div>
        </div>
      </div>
    </aside>
  );
}
