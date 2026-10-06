'use client';

/**
 * Umpan balik suara untuk Konsol Scan (FE-026).
 *
 * Dibangkitkan dengan Web Audio, bukan berkas mp3: tidak ada aset yang perlu
 * diunduh, tidak ada jeda muat pertama, dan nadanya bisa dibedakan jelas.
 * Petugas gerbang menghadap antrean siswa, bukan layar — perbedaan bunyi
 * inilah yang membuatnya tahu hasilnya tanpa menoleh.
 *
 *   sukses  : dua nada naik, pendek dan renyah
 *   terlambat: dua nada, yang kedua lebih rendah — terdengar "mengingatkan"
 *   gagal   : satu nada rendah panjang yang jelas berbeda dari keduanya
 */
type Jenis = 'sukses' | 'terlambat' | 'gagal';

let ctx: AudioContext | null = null;

function konteks(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  const Konstruktor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Konstruktor) return null;
  ctx = new Konstruktor();
  return ctx;
}

function nada(c: AudioContext, freq: number, mulai: number, durasi: number, volume: number) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;

  // Amplop naik-turun singkat; tanpa ini terdengar "klik" di awal dan akhir.
  gain.gain.setValueAtTime(0, mulai);
  gain.gain.linearRampToValueAtTime(volume, mulai + 0.01);
  gain.gain.setValueAtTime(volume, mulai + durasi - 0.03);
  gain.gain.linearRampToValueAtTime(0, mulai + durasi);

  osc.connect(gain).connect(c.destination);
  osc.start(mulai);
  osc.stop(mulai + durasi + 0.02);
}

export function bunyikan(jenis: Jenis, volume = 0.25) {
  const c = konteks();
  if (!c) return;
  // Browser menangguhkan AudioContext sampai ada interaksi pengguna.
  if (c.state === 'suspended') void c.resume();

  const t = c.currentTime;
  if (jenis === 'sukses') {
    nada(c, 880, t, 0.09, volume);
    nada(c, 1320, t + 0.1, 0.12, volume);
  } else if (jenis === 'terlambat') {
    nada(c, 1046, t, 0.09, volume);
    nada(c, 784, t + 0.1, 0.16, volume);
  } else {
    nada(c, 200, t, 0.42, volume);
  }
}

/**
 * Dipanggil sekali dari gestur pengguna (klik tombol mulai) supaya
 * AudioContext berpindah dari 'suspended'. Tanpa ini bunyi pertama hilang
 * begitu saja, dan operator mengira suaranya rusak.
 */
export function siapkanBunyi() {
  const c = konteks();
  if (c && c.state === 'suspended') void c.resume();
  return c?.state ?? 'tidak-didukung';
}
