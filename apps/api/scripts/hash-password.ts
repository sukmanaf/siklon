import { hash } from '@node-rs/argon2';

const password = process.argv[2];
if (!password) {
  console.error('Pemakaian: pnpm --filter @siklon/api hash "PasswordAnda"');
  process.exit(1);
}
console.log(await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 }));
