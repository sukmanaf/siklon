import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { buatApp } from '../src/app.js';

const app = buatApp();

describe('GET /api/v1/health', () => {
  it('menjawab 200 dan melaporkan database tersambung', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.db).toBe('tersambung');
  });
});

describe('penanganan error', () => {
  it('rute tidak dikenal menjawab 404 dengan bentuk baku', async () => {
    const res = await request(app).get('/api/v1/entah');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ ok: false, error: { code: 'ROUTE_NOT_FOUND' } });
  });

  it('JSON rusak menjawab 400, bukan 500', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{rusak');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('JSON_RUSAK');
  });

  it('tidak membocorkan header x-powered-by', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
