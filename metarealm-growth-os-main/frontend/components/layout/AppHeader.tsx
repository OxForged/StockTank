"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, PanelLeft, Search } from "lucide-react";
import { titleForPath } from "@/components/navigation/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AppHeaderProps {
  onOpenMobileMenu: () => void;
}

export function AppHeader({ onOpenMobileMenu }: AppHeaderProps) {
  const pathname = usePathname();
  const [today, setToday] = useState("");

  // Rendered after mount to avoid any server/client timezone mismatch.
  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    );
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur md:px-8">
      <Button
        variant="ghost"
        size="icon"
        onClick={onOpenMobileMenu}
        className="size-8 lg:hidden"
      >
        <PanelLeft />
        <span className="sr-only">Open menu</span>
      </Button>

      <h1 className="truncate text-sm font-medium">{titleForPath(pathname)}</h1>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search companies, deals, content…"
            className="h-8 w-64 border-transparent bg-secondary/60 pl-8 text-xs focus-visible:ring-1"
          />
        </div>

        <Button variant="ghost" size="icon" className="relative size-8">
          <Bell />
          <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />
          <span className="sr-only">Notifications</span>
        </Button>

        {today && (
          <span className="hidden whitespace-nowrap text-xs text-muted-foreground sm:inline">
            {today}
          </span>
        )}
      </div>
    </header>
  );
}
