#!/usr/bin/env node
/**
 * Penyatu path: satu port, dua tujuan.
 *
 * Dipakai untuk demo publik dari laptop lewat tunnel (cloudflared/ngrok).
 * Web dan API punya URL sendiri-sendiri di localhost, tapi cookie sesi API
 * memakai `sameSite: 'lax'` — kalau keduanya di-tunnel sebagai dua domain
 * publik terpisah, browser menolak mengirim cookie itu ke permintaan API
 * (beda situs), dan login akan terlihat berhasil sedetik lalu terpental balik
 * ke halaman login.
 *
 * Proxy ini membuat browser melihat SATU domain: `/api/*` dan `/socket.io/*`
 * diteruskan ke API (4000), sisanya ke web (3000). Tanpa mengubah kebijakan
 * cookie di kode aplikasi sama sekali.
 *
 * Tanpa dependensi tambahan — cukup `node:http`. WebSocket (dipakai Socket.IO
 * dan HMR dev server Next.js) diteruskan manual lewat penyambungan langsung
 * (pipe) dua socket TCP, persis yang dilakukan pustaka reverse-proxy pada
 * umumnya untuk permintaan `Upgrade: websocket`.
 */
import http from 'node:http';
import net from 'node:net';

const PORT = Number(process.env.PORT ?? 8787);
const WEB = { host: '127.0.0.1', port: Number(process.env.WEB_PORT ?? 3000) };
const API = { host: '127.0.0.1', port: Number(process.env.API_PORT ?? 4000) };

/** `/api/...` dan `/socket.io/...` ke API; selain itu ke Next.js. */
function tujuan(pathname) {
  return pathname.startsWith('/api/') || pathname.startsWith('/socket.io/') ? API : WEB;
}

const server = http.createServer((req, res) => {
  const pathname = req.url?.split('?')[0] ?? '/';
  const t = tujuan(pathname);

  const diteruskan = http.request(
    { host: t.host, port: t.port, method: req.method, path: req.url, headers: req.headers },
    (respons) => {
      res.writeHead(respons.statusCode ?? 502, respons.headers);
      respons.pipe(res);
    },
  );
  diteruskan.on('error', (err) => {
    // Backend belum menyala biasanya sebabnya — pesan ini muncul di terminal
    // yang menjalankan proxy, bukan di layar pengguna.
    console.error(`[proxy] ${t.host}:${t.port} gagal dihubungi: ${err.message}`);
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Gagal menghubungi server tujuan.');
  });
  req.pipe(diteruskan);
});

/**
 * Permintaan `Upgrade: websocket` tidak lewat handler `request` biasa —
 * Node memisahkannya ke event `upgrade`. Socket klien dan socket ke backend
 * disambungkan langsung dua arah begitu backend menjawab 101.
 */
server.on('upgrade', (req, socketKlien, kepalaSudahTerbaca) => {
  const pathname = req.url?.split('?')[0] ?? '/';
  const t = tujuan(pathname);

  const socketBackend = net.connect(t.port, t.host, () => {
    const baris = [`${req.method} ${req.url} HTTP/1.1`];
    for (const [k, v] of Object.entries(req.headers)) {
      baris.push(`${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
    }
    socketBackend.write(baris.join('\r\n') + '\r\n\r\n');
    if (kepalaSudahTerbaca?.length) socketBackend.write(kepalaSudahTerbaca);
    socketBackend.pipe(socketKlien);
    socketKlien.pipe(socketBackend);
  });
  socketBackend.on('error', () => socketKlien.destroy());
  socketKlien.on('error', () => socketBackend.destroy());
});

server.listen(PORT, () => {
  console.log(`Proxy demo publik siap di http://localhost:${PORT}`);
  console.log(`  /api/*, /socket.io/*  -> ${API.host}:${API.port}`);
  console.log(`  lainnya               -> ${WEB.host}:${WEB.port}`);
  console.log(`\nArahkan tunnel ke port ${PORT}, BUKAN ke 3000 atau 4000 langsung.`);
});
