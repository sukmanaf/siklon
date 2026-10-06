/**
 * Menolak scan berulang untuk NIS yang sama dalam rentang tertentu.
 *
 * Ini penting di gerbang: kartu yang tidak langsung terbaca membuat siswa
 * menempelkannya dua-tiga kali, dan scanner auto-sense bisa membaca kartu yang
 * sama beberapa kali dalam sekejap. Ditahan di sini, bukan di server, supaya
 * tidak membebani jaringan saat 600 siswa datang bersamaan.
 */
export class Debounce {
  private terakhir = new Map<string, number>();

  constructor(private detik: number) {}

  setDetik(detik: number) {
    this.detik = detik;
  }

  /** true bila scan ini harus diabaikan. */
  perluDiabaikan(nis: string, waktu = Date.now()): boolean {
    const t = this.terakhir.get(nis);
    if (t !== undefined && waktu - t < this.detik * 1000) return true;
    this.terakhir.set(nis, waktu);
    return false;
  }

  /** Buang catatan lama supaya Map tidak tumbuh sepanjang hari. */
  bersihkan(waktu = Date.now()) {
    const batas = this.detik * 1000 * 4;
    for (const [nis, t] of this.terakhir) {
      if (waktu - t > batas) this.terakhir.delete(nis);
    }
  }

  get ukuran() {
    return this.terakhir.size;
  }
}
