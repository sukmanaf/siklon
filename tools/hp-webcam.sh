#!/usr/bin/env bash
#
# Menyalurkan kamera HP (DroidCam) ke kamera virtual PC, supaya browser
# melihatnya sebagai webcam biasa.
#
#   1. HP dicolok kabel USB, USB debugging menyala, mode USB = File Transfer
#   2. Aplikasi DroidCam terbuka di HP
#   3. Jalankan skrip ini, biarkan terminalnya terbuka selama dipakai
#   4. Di browser: Scanner -> Kamera Perangkat Ini -> pilih "HP Scanner (DroidCam)"
#
# Hentikan dengan Ctrl+C.
set -euo pipefail

NOMOR_VIDEO=${NOMOR_VIDEO:-9}
PORT=${PORT:-4747}
PERANGKAT="/dev/video${NOMOR_VIDEO}"
APLIKASI_HP="com.dev47apps.obsdroidcam"

gagal() { echo "GAGAL: $*" >&2; exit 1; }

[[ -e "$PERANGKAT" ]] || gagal "$PERANGKAT belum ada. Jalankan dulu: sudo tools/pasang-webcam-hp.sh"
command -v adb >/dev/null || gagal "adb tidak terpasang."
command -v ffmpeg >/dev/null || gagal "ffmpeg tidak terpasang."

echo "==> Mencari HP"
adb start-server >/dev/null 2>&1 || true
[[ -n "$(adb devices | sed -n '2p')" ]] || gagal "HP tidak terbaca. Colok kabel, dan setujui dialog USB debugging di layar HP."
adb devices | sed -n '2p' | sed 's/^/    /'

echo "==> Membuka DroidCam di HP (kalau belum terbuka)"
adb shell monkey -p "$APLIKASI_HP" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true

echo "==> Meneruskan port $PORT"
adb forward "tcp:${PORT}" "tcp:${PORT}" >/dev/null

# Aplikasi butuh beberapa detik untuk menyalakan servernya sesudah dibuka.
#
# Yang diperiksa SENGAJA /remote, bukan /video. DroidCam hanya melayani satu
# klien video pada satu waktu: menyentuh /video di sini merampas jatah itu, dan
# ffmpeg sesudahnya cuma kebagian aliran kosong lalu mati dengan
# "No JPEG data found in image" — di HP terlihat sebagai kamera yang menyala
# sekejap lalu tertutup lagi.
echo "==> Menunggu aplikasi DroidCam siap"
siap=0
for _ in $(seq 1 20); do
  if curl -s -m 2 -o /dev/null "http://127.0.0.1:${PORT}/remote"; then siap=1; break; fi
  sleep 1
done
[[ $siap -eq 1 ]] || gagal "DroidCam tidak menjawab di port ${PORT}. Pastikan aplikasinya terbuka di layar HP."

# Kalau ada penyalur lama yang masih menempel, ffmpeg baru tidak akan kebagian
# aliran — alasannya sama: satu klien saja.
if pgrep -f "${PORT}/video" >/dev/null; then
  echo "==> Menghentikan penyalur lama yang masih berjalan"
  pkill -f "${PORT}/video" || true
  sleep 2
fi

bersihkan() {
  echo
  echo "==> Berhenti. Melepas penerusan port."
  adb forward --remove "tcp:${PORT}" >/dev/null 2>&1 || true
}
trap bersihkan EXIT INT TERM

echo "==> Menyalurkan kamera HP ke ${PERANGKAT} — biarkan jendela ini terbuka"
echo

# nobuffer + low_delay menekan jeda. Untuk membaca QR, jeda setengah detik saja
# sudah terasa: petugas menempelkan kartu, layarnya baru bereaksi belakangan.
#
# analyzeduration/probesize ditulis eksplisit karena `-fflags nobuffer`
# menolkannya; nilai 0 membuat pesan galat jadi menyesatkan kalau alirannya
# memang bermasalah.
exec ffmpeg -hide_banner -loglevel warning \
  -fflags nobuffer -flags low_delay \
  -f mjpeg -analyzeduration 5M -probesize 5M \
  -i "http://127.0.0.1:${PORT}/video" \
  -pix_fmt yuv420p \
  -f v4l2 "$PERANGKAT"
