import type { Metadata } from 'next';
import { FormGantiPassword } from './form-ganti-password';

export const metadata: Metadata = { title: 'Ganti Password' };

export default function HalamanGantiPassword() {
  return (
    <div className="grid min-h-screen place-items-center bg-background p-4">
      <FormGantiPassword />
    </div>
  );
}
