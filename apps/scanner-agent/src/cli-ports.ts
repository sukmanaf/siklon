/**
 * Alat bantu diagnosa: menampilkan port serial yang terlihat sistem.
 *
 * Dipakai saat memasang di PC sekolah — kalau daftarnya kosong, artinya
 * scanner masih dalam mode keyboard dan belum diubah ke USB Virtual COM Port.
 */
import { daftarPort } from './serial.js';

// --semua menampilkan juga port bawaan motherboard yang biasanya disaring.
const semua = process.argv.includes('--semua');
const ports = await daftarPort(semua);

if (ports.length === 0) {
  console.log('\nTidak ada port serial yang terdeteksi.\n');
  console.log('Kemungkinan penyebabnya:');
  console.log('  1. Scanner masih mode keyboard — ubah ke USB Virtual COM Port');
  console.log('     dengan memindai barcode setup dari buku manualnya.');
  console.log('  2. Kabel USB belum tersambung.');
  console.log('  3. Di Linux: pengguna belum masuk grup dialout.');
  console.log('     Perbaiki dengan: sudo usermod -aG dialout $USER  (lalu logout-login)\n');
  process.exit(0);
}

console.log(`\n${ports.length} port serial terdeteksi${semua ? ' (termasuk bawaan motherboard)' : ''}:\n`);
for (const p of ports) {
  const kunci = p.serialNumber
    ? `SN:${p.serialNumber}`
    : p.locationId
      ? `USB:${p.locationId}`
      : `PORT:${p.path}`;
  console.log(`  ${p.path}`);
  console.log(`    merek     : ${p.manufacturer ?? '-'}`);
  console.log(`    VID:PID   : ${p.vendorId ?? '-'}:${p.productId ?? '-'}`);
  console.log(`    kunci     : ${kunci}`);
  if (!p.serialNumber) {
    console.log('    PERINGATAN: tanpa nomor seri — jangan pindah colokan USB-nya,');
    console.log('                karena pemetaannya ikut lokasi port fisik.');
  }
  console.log();
}
if (!semua) {
  console.log('Port serial bawaan motherboard (/dev/ttyS*) disaring otomatis.');
  console.log('Jalankan dengan --semua untuk menampilkannya juga.\n');
}
console.log('Kunci di atas dipakai server untuk memetakan scanner ke gerbang.');
console.log('Beri nama tiap scanner di halaman Scanner pada aplikasi.\n');
