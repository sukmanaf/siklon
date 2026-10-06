import { KUNCI_TEMA } from '@/lib/tema';

/**
 * Skrip pemblokir yang memasang atribut tema SEBELUM halaman digambar.
 *
 * Tanpa ini pengguna tema gelap melihat kilatan putih tiap kali memuat ulang,
 * karena React baru berjalan setelah HTML pertama tampil. try/catch dipakai
 * karena localStorage bisa dilarang (mode privat, kebijakan browser) dan
 * kegagalannya tidak boleh menggagalkan seluruh halaman.
 */
const SKRIP = `(function(){try{
var t=localStorage.getItem('${KUNCI_TEMA}')||'sistem';
var g=t==='gelap'||(t==='sistem'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.setAttribute('data-theme',g?'dark':'light');
}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export function ScriptTema() {
  return <script dangerouslySetInnerHTML={{ __html: SKRIP }} />;
}
