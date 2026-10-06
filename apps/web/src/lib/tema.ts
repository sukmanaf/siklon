/**
 * Konstanta tema.
 *
 * Sengaja berada di modul biasa — BUKAN modul 'use client'. ScriptTema adalah
 * server component, dan nilai yang diimpor dari modul klien akan berubah jadi
 * stub yang melempar error saat dirangkai ke dalam skrip inline.
 */
export const KUNCI_TEMA = 'siklon-tema';

export type Tema = 'terang' | 'gelap' | 'sistem';
