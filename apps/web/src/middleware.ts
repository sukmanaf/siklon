import { NextResponse, type NextRequest } from 'next/server';

/** Sama dengan NAMA_COOKIE di apps/api/src/lib/jwt.ts. */
const NAMA_COOKIE = 'siklon_token';

/** Rute yang boleh dibuka tanpa masuk. */
const PUBLIK = ['/login'];

/**
 * Proteksi rute (FE-008).
 *
 * Middleware ini HANYA melihat ada atau tidaknya cookie — tanda tangan JWT
 * tidak diverifikasi di sini, karena itu berarti membagikan JWT_SECRET ke
 * proses web tanpa perlu. Penjagaan yang sesungguhnya tetap di backend: setiap
 * endpoint memeriksa tanda tangan, token_version, dan status akun.
 *
 * Gunanya di sini murni pengalaman pemakaian: pengunjung tanpa sesi langsung
 * mendarat di halaman login, bukan melihat kerangka aplikasi berkedip lalu
 * terlempar keluar.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Rute API dan socket.io tidak diproses oleh middleware proteksi halaman web
  if (pathname.startsWith('/api') || pathname.startsWith('/socket.io')) {
    return NextResponse.next();
  }

  const punyaCookie = req.cookies.has(NAMA_COOKIE);
  const halamanPublik = PUBLIK.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!punyaCookie && !halamanPublik) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    // Simpan tujuan asli supaya setelah masuk pengguna kembali ke sana,
    // bukan selalu dilempar ke dashboard.
    url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }

  /*
   * Cookie ada, tapi aplikasi baru saja diberi tahu server bahwa sesinya
   * ditolak (`?sesi=habis`). Memantulkannya ke dashboard di sini akan membuat
   * lingkaran: dashboard memanggil /auth/me, dapat 401, mengalihkan ke login,
   * dipantulkan lagi ke dashboard — dan pengguna hanya melihat kerangka
   * pemuatan tanpa penjelasan.
   */
  const sesiHabis = req.nextUrl.searchParams.get('sesi') === 'habis';

  if (punyaCookie && halamanPublik && !sesiHabis) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Berkas statis, gambar, rute API, socket.io, dan berkas khusus Next tidak perlu diperiksa.
  matcher: ['/((?!api|socket\\.io|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
