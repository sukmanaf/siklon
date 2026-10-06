'use client';

import { useId } from 'react';
import {
  useController,
  type Control,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type RenderProps<T extends FieldValues> = {
  id: string;
  invalid: boolean;
  /** Sebarkan ke elemen input: value, onChange, onBlur, name, ref. */
  field: ControllerRenderProps<T, FieldPath<T>>;
  'aria-describedby': string | undefined;
};

/**
 * Satu baris form: label, kontrol, deskripsi, dan pesan error — lengkap dengan
 * kaitan aksesibilitasnya (`htmlFor`, `aria-invalid`, `aria-describedby`).
 *
 * Kontrolnya sengaja dititipkan lewat render prop, bukan dipilih di dalam
 * komponen, supaya field yang sama bisa berisi Input, Select, atau textarea
 * tanpa komponen ini perlu tahu semua jenis kontrol yang ada.
 */
export function FormField<T extends FieldValues>({
  control,
  name,
  label,
  deskripsi,
  wajib,
  className,
  children,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  deskripsi?: ReactNode;
  wajib?: boolean;
  className?: string;
  children: (props: RenderProps<T>) => ReactNode;
}) {
  const id = useId();
  const { field, fieldState } = useController({ control, name });
  const pesan = fieldState.error?.message;
  const invalid = Boolean(pesan);

  const idDeskripsi = deskripsi ? `${id}-desk` : undefined;
  const idError = invalid ? `${id}-err` : undefined;
  const describedBy = [idDeskripsi, idError].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {wajib && <span className="ml-0.5 text-destructive">*</span>}
      </Label>

      {children({ id, invalid, field, 'aria-describedby': describedBy })}

      {deskripsi && (
        <p id={idDeskripsi} className="text-[11.5px] leading-relaxed text-muted-foreground">
          {deskripsi}
        </p>
      )}
      {pesan && (
        <p id={idError} className="text-[11.5px] font-medium text-destructive">
          {pesan}
        </p>
      )}
    </div>
  );
}
