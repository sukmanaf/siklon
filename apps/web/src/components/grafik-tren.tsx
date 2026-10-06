'use client';

import { useId, useMemo, useState } from 'react';
import { tanggalPendek } from '@/lib/tanggal';

export type TitikTren = { tanggal: string; persen: number | null; tercatat: number };

const L = 34; // ruang untuk label sumbu Y
const R = 12;
const A = 12;
const B = 22; // ruang untuk label sumbu X
const LEBAR = 620;
const TINGGI = 190;

/**
 * Tren persentase kehadiran.
 *
 * Satu seri saja, jadi tidak ada legenda — judul kartunya yang menamai seri
 * ini. Nilainya tidak ditulis di tiap titik (itu jadi kekacauan yang tak
 * terbaca); hanya titik terakhir yang diberi label, sisanya lewat hover.
 * Garisnya tipis dan gridnya hairline solid agar datanya yang menonjol,
 * bukan kerangkanya.
 *
 * Aksesibilitas: SVG diberi ringkasan teks, dan angka lengkapnya tersedia
 * sebagai tabel yang bisa dibuka — grafik tidak boleh jadi satu-satunya
 * cara membaca data ini.
 */
export function GrafikTren({ data }: { data: TitikTren[] }) {
  const idGradien = useId().replace(/:/g, '');
  const [sorot, setSorot] = useState<number | null>(null);

  const titik = useMemo(() => data.filter((d) => d.persen !== null), [data]);

  const posisi = useMemo(() => {
    if (data.length === 0) return [];
    const langkah = data.length > 1 ? (LEBAR - L - R) / (data.length - 1) : 0;
    return data.map((d, i) => ({
      ...d,
      x: L + i * langkah,
      // Sumbu selalu 0–100: persentase kehadiran punya batas alami, dan
      // skala yang menyesuaikan data membuat penurunan kecil terlihat dramatis.
      y: A + (TINGGI - A - B) * (1 - (d.persen ?? 0) / 100),
    }));
  }, [data]);

  const adaData = titik.length > 0;
  const garis = posisi.filter((p) => p.persen !== null);
  const jalur = garis.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area =
    garis.length > 0
      ? `${jalur} L ${garis[garis.length - 1]!.x} ${TINGGI - B} L ${garis[0]!.x} ${TINGGI - B} Z`
      : '';

  const terakhir = garis[garis.length - 1];
  const aktif = sorot !== null ? posisi[sorot] : null;

  const rata =
    titik.length > 0
      ? Math.round((titik.reduce((t, d) => t + (d.persen ?? 0), 0) / titik.length) * 10) / 10
      : null;

  if (!adaData) {
    return (
      <p className="py-10 text-center text-[13px] text-muted-foreground">
        Belum ada data kehadiran untuk digambar. Grafik muncul setelah ada presensi tercatat.
      </p>
    );
  }

  return (
    <div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${LEBAR} ${TINGGI}`}
          className="w-full"
          style={{ height: TINGGI }}
          role="img"
          aria-label={`Tren persentase kehadiran ${data.length} hari terakhir, rata-rata ${rata ?? 0} persen. Angka lengkapnya ada di tabel di bawah grafik.`}
          onMouseLeave={() => setSorot(null)}
        >
          <defs>
            <linearGradient id={`isi-${idGradien}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.24" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid hairline solid — satu tingkat dari permukaan, tidak putus-putus. */}
          {[0, 25, 50, 75, 100].map((p) => {
            const y = A + (TINGGI - A - B) * (1 - p / 100);
            return (
              <g key={p}>
                <line x1={L} y1={y} x2={LEBAR - R} y2={y} stroke="var(--border-c)" strokeWidth="1" />
                <text
                  x={L - 6}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-[var(--faint)] text-[9px]"
                >
                  {p}%
                </text>
              </g>
            );
          })}

          {area && <path d={area} fill={`url(#isi-${idGradien})`} />}
          {jalur && (
            <path
              d={jalur}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Crosshair saat hover. */}
          {aktif && aktif.persen !== null && (
            <>
              <line
                x1={aktif.x}
                y1={A}
                x2={aktif.x}
                y2={TINGGI - B}
                stroke="var(--faint)"
                strokeWidth="1"
              />
              <circle
                cx={aktif.x}
                cy={aktif.y}
                r="5"
                fill="var(--primary)"
                stroke="var(--surface)"
                strokeWidth="2"
              />
            </>
          )}

          {/* Hanya titik terakhir yang diberi label langsung. */}
          {terakhir && (
            <>
              <circle
                cx={terakhir.x}
                cy={terakhir.y}
                r="4"
                fill="var(--primary)"
                stroke="var(--surface)"
                strokeWidth="2"
              />
              {/*
                Label dipindah ke bawah titik bila titiknya menempel di tepi
                atas — kalau tidak, angkanya terpotong keluar viewBox persis
                saat kehadirannya 100%, yaitu keadaan yang paling sering muncul.
              */}
              <text
                x={terakhir.x - 6}
                y={terakhir.y - A < 12 ? terakhir.y + 14 : terakhir.y - 9}
                textAnchor="end"
                className="fill-[var(--text)] text-[10px] font-bold"
              >
                {terakhir.persen}%
              </text>
            </>
          )}

          {/* Label tanggal pertama dan terakhir saja, supaya tidak berdesakan. */}
          {posisi.length > 0 && (
            <>
              <text x={L} y={TINGGI - 6} className="fill-[var(--faint)] text-[9px]">
                {tanggalPendek(posisi[0]!.tanggal)}
              </text>
              <text
                x={LEBAR - R}
                y={TINGGI - 6}
                textAnchor="end"
                className="fill-[var(--faint)] text-[9px]"
              >
                {tanggalPendek(posisi[posisi.length - 1]!.tanggal)}
              </text>
            </>
          )}

          {/* Bidang tangkap hover yang lebih besar daripada titiknya. */}
          {posisi.map((p, i) => (
            <rect
              key={p.tanggal}
              x={p.x - (LEBAR - L - R) / Math.max(1, posisi.length * 2)}
              y={A}
              width={(LEBAR - L - R) / Math.max(1, posisi.length)}
              height={TINGGI - A - B}
              fill="transparent"
              onMouseEnter={() => setSorot(i)}
            />
          ))}
        </svg>

        {aktif && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11.5px] shadow-card"
            style={{ left: `${(aktif.x / LEBAR) * 100}%`, top: 0 }}
          >
            <div className="num font-semibold">{tanggalPendek(aktif.tanggal)}</div>
            <div className="text-muted-foreground">
              {aktif.persen === null ? (
                'tidak ada data'
              ) : (
                <>
                  <b className="num text-foreground">{aktif.persen}%</b> hadir ·{' '}
                  <span className="num">{aktif.tercatat}</span> tercatat
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-[11.5px] text-muted-foreground hover:text-foreground">
          Lihat angkanya sebagai tabel
        </summary>
        <div className="mt-2 max-h-48 overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[10.5px] text-muted-foreground uppercase">
                <th className="py-1">Tanggal</th>
                <th className="py-1">Hadir</th>
                <th className="py-1">Tercatat</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.tanggal} className="border-t border-border">
                  <td className="num py-1">{tanggalPendek(d.tanggal)}</td>
                  <td className="num py-1">{d.persen === null ? '—' : `${d.persen}%`}</td>
                  <td className="num py-1">{d.tercatat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
