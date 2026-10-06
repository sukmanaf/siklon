import { existsSync } from 'node:fs';
// Test memakai database yang sama dengan development. Aman karena test di fase ini
// hanya membaca; test yang menulis nanti wajib membersihkan datanya sendiri.
if (existsSync('.env')) process.loadEnvFile('.env');
