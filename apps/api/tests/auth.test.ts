import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { buatApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/lib/password.js';

const app = buatApp();
const PW = 'rahasia123';
const UJI = 'ujiauth_user';

let userId: string;

beforeAll(async () => {
  await prisma.users.deleteMany({ where: { username: { startsWith: 'ujiauth_' } } });
  const u = await prisma.users.create({
    data: {
      username: UJI,
      full_name: 'Pengguna Uji',
      password_hash: await hashPassword(PW),
      role: 'ADMIN',
      must_change_password: false,
    },
  });
  userId = u.id;
});

afterAll(async () => {
  await prisma.users.deleteMany({ where: { username: { startsWith: 'ujiauth_' } } });
  await prisma.$disconnect();
});

const login = (username: string, password: string) =>
  request(app).post('/api/v1/auth/login').send({ username, password });

describe('POST /auth/login', () => {
  it('login benar mengembalikan user dan menyetel cookie httpOnly', async () => {
    const res = await login(UJI, PW);
    expect(res.status).toBe(200);
    expect(res.body.data.user.username).toBe(UJI);
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toContain('siklon_token=');
    expect(cookie).toContain('HttpOnly');
  });

  it('TIDAK pernah mengembalikan password_hash', async () => {
    const res = await login(UJI, PW);
    expect(JSON.stringify(res.body)).not.toContain('argon2');
  });

  it('password salah dan username tidak ada memberi pesan yang SAMA', async () => {
    const salah = await login(UJI, 'salah-sekali');
    const kosong = await login('tidak_ada_sama_sekali', 'apa pun');
    expect(salah.status).toBe(401);
    expect(kosong.status).toBe(401);
    // Kalau pesannya beda, penyerang bisa memetakan username mana yang terdaftar.
    expect(salah.body.error.message).toBe(kosong.body.error.message);
  });

  it('akun nonaktif ditolak 403 walau passwordnya benar', async () => {
    await prisma.users.update({ where: { id: userId }, data: { is_active: false } });
    const res = await login(UJI, PW);
    expect(res.status).toBe(403);
    await prisma.users.update({ where: { id: userId }, data: { is_active: true } });
  });

  it('body tidak valid ditolak 400 dengan daftar field', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ username: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDASI_GAGAL');
  });
});

describe('GET /auth/me', () => {
  it('tanpa token ditolak 401', async () => {
    expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
  });

  it('token asal-asalan ditolak 401, bukan 500', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer bukan.token.beneran');
    expect(res.status).toBe(401);
  });

  it('token sah mengembalikan profil', async () => {
    const { body } = await login(UJI, PW);
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${body.data.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.peran).toBe('ADMIN');
  });
});

describe('token_version membatalkan sesi lama', () => {
  it('token lama ditolak setelah ganti password', async () => {
    const { body } = await login(UJI, PW);
    const tokenLama = body.data.token;

    const ganti = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${tokenLama}`)
      .send({ passwordLama: PW, passwordBaru: 'passwordBaru123' });
    expect(ganti.status).toBe(200);

    // Inti mekanisme tanpa tabel sesi: token lama harus mati seketika.
    const pakaiLama = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tokenLama}`);
    expect(pakaiLama.status).toBe(401);

    // Token baru dari respons ganti password harus tetap jalan.
    const pakaiBaru = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${ganti.body.data.token}`);
    expect(pakaiBaru.status).toBe(200);

    // kembalikan password semula untuk test berikutnya
    await prisma.users.update({
      where: { id: userId },
      data: { password_hash: await hashPassword(PW), token_version: { increment: 1 } },
    });
  });

  it('password lama yang salah ditolak 400', async () => {
    const { body } = await login(UJI, PW);
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${body.data.token}`)
      .send({ passwordLama: 'bukan-ini', passwordBaru: 'passwordBaru123' });
    expect(res.status).toBe(400);
  });

  it('password baru tidak boleh sama dengan yang lama', async () => {
    const { body } = await login(UJI, PW);
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${body.data.token}`)
      .send({ passwordLama: PW, passwordBaru: PW });
    expect(res.status).toBe(400);
  });
});

describe('wajib ganti password menutup akses', () => {
  it('pengguna dengan must_change_password tidak bisa membuka modul lain', async () => {
    await prisma.users.update({ where: { id: userId }, data: { must_change_password: true } });
    const { body } = await login(UJI, PW);
    const token = body.data.token;

    // /auth/me tetap boleh — frontend butuh ini untuk tahu harus menampilkan
    // layar ganti password.
    expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`)).status).toBe(200);

    // Modul lain harus tertutup, walaupun URL-nya diketik langsung.
    const users = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${token}`);
    expect(users.status).toBe(403);

    await prisma.users.update({ where: { id: userId }, data: { must_change_password: false } });
  });
});
