'use client';

import * as React from 'react';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Input password dengan tombol lihat/sembunyikan.
 *
 * Berguna justru di tempat ini: password sementara dari admin berisi karakter
 * campuran seperti "Xk7#mQ2p" dan sangat mudah salah ketik kalau tidak terlihat.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, ...props }, ref) => {
    const [terlihat, setTerlihat] = React.useState(false);
    return (
      <div className="relative">
        <Input
          ref={ref}
          type={terlihat ? 'text' : 'password'}
          className={cn('pr-9', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setTerlihat((v) => !v)}
          aria-label={terlihat ? 'Sembunyikan password' : 'Tampilkan password'}
          className="absolute inset-y-0 right-0 grid w-9 place-items-center text-muted-foreground transition-colors hover:text-foreground"
        >
          {terlihat ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';
