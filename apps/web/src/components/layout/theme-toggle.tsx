'use client';

import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTema } from '@/hooks/use-tema';
import type { Tema } from '@/lib/tema';

const PILIHAN: { nilai: Tema; label: string; Ikon: typeof SunIcon }[] = [
  { nilai: 'terang', label: 'Terang', Ikon: SunIcon },
  { nilai: 'gelap', label: 'Gelap', Ikon: MoonIcon },
  { nilai: 'sistem', label: 'Ikuti sistem', Ikon: MonitorIcon },
];

export function ThemeToggle() {
  const { tema, setTema } = useTema();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon-sm" aria-label="Ganti tema">
          <SunIcon className="dark:hidden" />
          <MoonIcon className="hidden dark:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Tampilan</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PILIHAN.map(({ nilai, label, Ikon }) => (
          <DropdownMenuItem key={nilai} onSelect={() => setTema(nilai)}>
            <Ikon />
            {label}
            {tema === nilai && <span className="ml-auto text-xs text-primary">aktif</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
