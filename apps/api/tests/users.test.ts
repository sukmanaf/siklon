import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { buatApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/lib/password.js';

const app = buatApp();
const PW = 'rahasia123';

let tokenSA = '';
let tokenAdmin = '';
let idSA = '';
let idAdmin = '';
let idSA2 = '';

const bersihkan = () => prisma.users.deleteMany({ where: { username: { startsWith: 'ujiusr_' } } });

async function buatUser(username: string, role: 'SUPER_ADMIN' | 'ADMIN') {
  return prisma.users.create({
    data: {
      username,
      full_name: username,
      password_hash: await hashPassword(PW),
      role,
      must_change_password: false,
    },
  });
}
const masuk = async (username: string) => {
  const r = await request(app).post('/api/v1/auth/login').send({ username, password: PW });
  return r.body.data.token as string;
};

beforeAll(async () => {
  await bersihkan();
  idSA = (await buatUser('ujiusr_sa', 'SUPER_ADMIN')).id;
  idSA2 = (await buatUser('ujiusr_sa2', 'SUPER_ADMIN')).id;
  idAdmin = (await buatUser('ujiusr_admin', 'ADMIN')).id;
  tokenSA = await masuk('ujiusr_sa');
  tokenAdmin = await masuk('ujiusr_admin');
});
afterAll(async () => {
  await bersihkan();
  await prisma.$disconnect();
});

const sbg = (t: string) => (r: request.Test) => r.set('Authorization', `Bearer ${t}`);

describe('akses halaman Pengguna', () => {
  it('Admin biasa ditolak 403', async () => {
    const res = await sbg(tokenAdmin)(request(app).get('/api/v1/users'));
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('Super Admin');
  });

  it('Super Admin boleh melihat daftar', async () => {
    const res = await sbg(tokenSA)(request(app).get('/api/v1/users'));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('daftar pengguna tidak pernah memuat password_hash', async () => {
    const res = await sbg(tokenSA)(request(app).get('/api/v1/users'));
    expect(JSON.stringify(res.body)).not.toContain('argon2');
  });
});

describe('membuat akun', () => {
  it('akun baru selalu ADMIN, walau klien menitipkan role SUPER_ADMIN', async () => {
    const res = await sbg(tokenSA)(
      request(app)
        .post('/api/v1/users')
        .send({
          username: 'ujiusr_baru',
          full_name: 'Uji Baru',
          password: 'rahasia123',
          role: 'SUPER_ADMIN', // <- titipan jahat, harus diabaikan
        }),
    );
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('ADMIN');
    expect(res.body.data.must_change_password).toBe(true);
  });

  it('username ganda ditolak 409', async () => {
    const res = await sbg(tokenSA)(
      request(app)
        .post('/api/v1/users')
        .send({ username: 'ujiusr_admin', full_name: 'X', password: 'rahasia123' }),
    );
    expect(res.status).toBe(409);
  });

  it('username dengan spasi/huruf besar ditolak', async () => {
    const res = await sbg(tokenSA)(
      request(app)
        .post('/api/v1/users')
        .send({ username: 'Uji Salah', full_name: 'X', password: 'rahasia123' }),
    );
    expect(res.status).toBe(400);
  });
});

describe('penjagaan Super Admin', () => {
  it('Super Admin lain tidak bisa diubah lewat API', async () => {
    const res = await sbg(tokenSA)(
      request(app).patch(`/api/v1/users/${idSA2}`).send({ is_active: false }),
    );
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('CLI');
  });

  it('tidak bisa menonaktifkan akun sendiri', async () => {
    const res = await sbg(tokenSA)(request(app).delete(`/api/v1/users/${idSA}`));
    expect(res.status).toBe(400);
  });

  it('Super Admin aktif terakhir tidak bisa dinonaktifkan', async () => {
    // Sisakan satu saja: nonaktifkan uji_sa2 langsung lewat database,
    // lalu coba nonaktifkan diri sendiri dari sisi yang berbeda.
    await prisma.users.update({ where: { id: idSA2 }, data: { is_active: false } });
    const lain = await prisma.users.findMany({
      where: { role: 'SUPER_ADMIN', is_active: true, username: { not: { startsWith: 'uji' } } },
    });
    // superadmin bawaan seed juga terhitung, jadi test ini hanya bermakna
    // bila ia dinonaktifkan sementara.
    await prisma.users.updateMany({
      where: { id: { in: lain.map((u) => u.id) } },
      data: { is_active: false },
    });

    const res = await sbg(tokenSA)(request(app).delete(`/api/v1/users/${idSA}`));
    // ditolak entah karena "akun sendiri" atau "super admin terakhir" —
    // yang penting TIDAK berhasil.
    expect(res.status).toBeGreaterThanOrEqual(400);
    const masihAda = await prisma.users.count({ where: { role: 'SUPER_ADMIN', is_active: true } });
    expect(masihAda).toBeGreaterThanOrEqual(1);

    await prisma.users.updateMany({
      where: { id: { in: [...lain.map((u) => u.id), idSA2] } },
      data: { is_active: true },
    });
  });
});

describe('reset password mencabut sesi', () => {
  it('sesi pengguna mati setelah passwordnya direset admin', async () => {
    const tokenKorban = await masuk('ujiusr_admin');
    expect((await sbg(tokenKorban)(request(app).get('/api/v1/auth/me'))).status).toBe(200);

    const res = await sbg(tokenSA)(
      request(app).post(`/api/v1/users/${idAdmin}/reset-password`).send({ passwordBaru: 'passwordBaru123' }),
    );
    expect(res.status).toBe(200);

    // Kalau password direset karena akun dicurigai bocor, sesi penyerang
    // harus ikut mati — bukan menunggu token kedaluwarsa 12 jam.
    expect((await sbg(tokenKorban)(request(app).get('/api/v1/auth/me'))).status).toBe(401);

    await prisma.users.update({
      where: { id: idAdmin },
      data: { password_hash: await hashPassword(PW), must_change_password: false },
    });
  });
});

describe('penegakan wajib ganti password', () => {
  it('Super Admin yang wajib ganti password tetap tidak bisa membuka /users', async () => {
    await prisma.users.update({ where: { id: idSA }, data: { must_change_password: true } });
    const t = await masuk('ujiusr_sa');

    const res = await sbg(t)(request(app).get('/api/v1/users'));
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('mengganti password');

    // /auth/me tetap boleh, supaya frontend tahu harus menampilkan layar ganti password
    expect((await sbg(t)(request(app).get('/api/v1/auth/me'))).status).toBe(200);

    await prisma.users.update({ where: { id: idSA }, data: { must_change_password: false } });
  });
});
