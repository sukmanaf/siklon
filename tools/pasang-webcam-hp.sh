#!/usr/bin/env bash
#
# Pemasangan sekali jalan: menjadikan HP (lewat DroidCam) sebagai webcam di PC ini.
#
# Yang dipasang:
#   - v4l2loopback  : modul kernel yang membuat kamera virtual /dev/video9
#   - v4l-utils     : alat bantu untuk memeriksa kamera dari terminal
#
# Jalankan sekali saja:  sudo tools/pasang-webcam-hp.sh
# Pemakaian sehari-hari ada di tools/hp-webcam.sh (tidak butuh sudo).
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Skrip ini harus dijalankan dengan sudo:" >&2
  echo "  sudo $0" >&2
  exit 1
fi

NOMOR_VIDEO=9
LABEL="HP Scanner (DroidCam)"

echo "==> Memasang v4l2loopback-dkms dan v4l-utils"
apt-get update -qq
apt-get install -y v4l2loopback-dkms v4l-utils

# exclusive_caps=1 WAJIB. Tanpa itu Chrome tidak mau menampilkan kamera virtual
# di daftar perangkat — kameranya ada di /dev tapi tidak pernah muncul di
# halaman Scanner, dan tidak ada pesan error apa pun yang menjelaskan kenapa.
echo "==> Menulis konfigurasi modul"
cat > /etc/modprobe.d/siklon-hp-webcam.conf <<EOF
options v4l2loopback devices=1 video_nr=${NOMOR_VIDEO} card_label="${LABEL}" exclusive_caps=1
EOF

# Supaya kamera virtualnya sudah ada lagi setelah PC dinyalakan ulang.
echo v4l2loopback > /etc/modules-load.d/siklon-hp-webcam.conf

echo "==> Memuat modul"
modprobe -r v4l2loopback 2>/dev/null || true
modprobe v4l2loopback

if [[ -e "/dev/video${NOMOR_VIDEO}" ]]; then
  echo
  echo "SELESAI. Kamera virtual siap di /dev/video${NOMOR_VIDEO} dengan nama \"${LABEL}\"."
  v4l2-ctl --list-devices 2>/dev/null | grep -A2 "${LABEL}" || true
  echo
  echo "Langkah berikutnya (tanpa sudo):  tools/hp-webcam.sh"
else
  echo "GAGAL: /dev/video${NOMOR_VIDEO} tidak terbentuk." >&2
  echo "Periksa hasil build DKMS:  dkms status ; dmesg | tail -20" >&2
  exit 1
fi
