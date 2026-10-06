# Migrasi Database

`database/schema.sql` adalah **potret skema saat ini** — dipakai untuk memasang dari nol.
Berkas di folder ini adalah **perubahan bertahap** untuk database yang sudah berisi data.

## Aturan

1. Perubahan skema **selalu** ditulis sebagai berkas migrasi baru di sini, dengan nomor urut:
   `002_nama_perubahan.sql`, `003_…`. Jangan mengubah berkas yang sudah pernah dijalankan.
2. Setelah membuat migrasi, perbarui juga `database/schema.sql` supaya potretnya tetap cocok.
   Keduanya harus menghasilkan skema yang identik.
3. Tulis migrasi yang **aman dijalankan berulang** (`IF NOT EXISTS`, `IF EXISTS`).
4. Jalankan dengan `pnpm --filter @siklon/api migrate`, jangan `psql` manual — supaya tercatat.

## Cara menjalankan

```bash
pnpm --filter @siklon/api migrate          # jalankan yang belum pernah dijalankan
pnpm --filter @siklon/api migrate:status   # lihat mana yang sudah & belum
```

Riwayat tersimpan di tabel `schema_migrations`.

## Kenapa tidak `prisma migrate`?

Karena `schema.sql` yang jadi sumber kebenaran, bukan `schema.prisma` — alurnya
`db pull` (introspeksi), bukan `migrate dev`. Selain itu beberapa hal yang dipakai
proyek ini tidak bisa dimodelkan Prisma: partial unique index, view, trigger,
dan index GIN trigram.
