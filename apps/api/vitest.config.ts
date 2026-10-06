import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Memuat .env agar test integrasi memakai database yang sama.
    env: { NODE_ENV: 'test' },
    setupFiles: ['tests/setup.ts'],
  },
});
