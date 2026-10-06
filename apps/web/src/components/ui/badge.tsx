import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-relaxed whitespace-nowrap',
  {
    variants: {
      variant: {
        ok: 'bg-hadir-bg text-hadir',
        warn: 'bg-terlambat-bg text-terlambat',
        info: 'bg-izin-bg text-izin',
        violet: 'bg-sakit-bg text-sakit',
        danger: 'bg-alpa-bg text-alpa',
        muted: 'bg-libur-bg text-libur',
        primary: 'bg-primary-soft text-primary-ink',
      },
    },
    defaultVariants: { variant: 'muted' },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
