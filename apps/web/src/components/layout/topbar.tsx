'use client';

import { MenuIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { UserMenu } from '@/components/layout/user-menu';
import type { Saya } from '@/hooks/use-auth';

export function Topbar({
  judul,
  sub,
  saya,
  onBukaMenu,
}: {
  judul: string;
  sub?: string;
  saya: Saya;
  onBukaMenu: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card px-4 py-2.5 md:px-5">
      <Button
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        onClick={onBukaMenu}
        aria-label="Buka menu"
      >
        <MenuIcon />
      </Button>

      <div className="min-w-0">
        <h1 className="truncate text-[17px]">{judul}</h1>
        {sub && <div className="truncate text-[12.5px] text-muted-foreground">{sub}</div>}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <UserMenu saya={saya} />
      </div>
    </header>
  );
}
