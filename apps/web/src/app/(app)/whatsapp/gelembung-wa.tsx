'use client';

import { CheckCheckIcon } from 'lucide-react';

/**
 * Pratinjau pesan seperti yang dilihat wali murid di HP-nya.
 *
 * Sengaja meniru gelembung WhatsApp — latar gelap, gelembung hijau, centang
 * biru — karena yang ingin dinilai admin saat menyunting template bukan
 * "apakah teksnya benar", melainkan "apakah pesan ini enak dibaca orang tua
 * di layar HP". Format tebal WhatsApp (*teks*) ikut dirender.
 */
export function GelembungWa({ isi, nomor }: { isi: string; nomor?: string | null }) {
  return (
    <div className="rounded-xl bg-[#0b141a] p-4">
      <div className="mx-auto max-w-[320px]">
        <div className="ml-6 rounded-[10px] rounded-br-[3px] bg-[#005c4b] px-3 py-2.5 text-[12.8px] leading-relaxed text-[#e9edef] shadow">
          <div data-uji="isi-gelembung" className="whitespace-pre-wrap">{formatWa(isi)}</div>
          <div className="mt-1.5 flex items-center justify-end gap-1 text-[10px] opacity-70">
            {jamSekarang()}
            <CheckCheckIcon className="size-3 text-[#53bdeb]" />
          </div>
        </div>
        <div className="mt-3 text-center text-[10.5px] text-[#8696a0]">
          {nomor ? `Terkirim ke ${nomor}` : 'Contoh tampilan di HP wali murid'}
        </div>
      </div>
    </div>
  );
}

function jamSekarang() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Render penebalan gaya WhatsApp: *teks* jadi tebal.
 *
 * Sengaja tidak memakai dangerouslySetInnerHTML — isi template datang dari
 * database dan bisa memuat markup; menyisipkannya sebagai HTML akan jadi
 * lubang XSS di halaman admin.
 */
function formatWa(teks: string) {
  const bagian = teks.split(/(\*[^*\n]+\*)/g);
  return bagian.map((b, i) =>
    b.startsWith('*') && b.endsWith('*') && b.length > 2 ? (
      <b key={i}>{b.slice(1, -1)}</b>
    ) : (
      <span key={i}>{b}</span>
    ),
  );
}
