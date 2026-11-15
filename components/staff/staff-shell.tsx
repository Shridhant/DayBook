"use client";

import { CalendarDays, CalendarOff, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { ThemeToggle } from "@/components/admin/theme";
import { Avatar } from "@/components/ui/avatar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/staff", label: "Schedule", icon: CalendarDays },
  { href: "/staff/leave", label: "Leave", icon: CalendarOff },
];

/**
 * Technician portal frame. Technicians use it on their phones between clients, so navigation is a
 * bottom tab bar on small screens (thumb reach, 56px targets) and header tabs from `sm` up.
 */
export function StaffShell({ name, brand, children }: { name: string; brand: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/staff" ? pathname === "/staff" : pathname.startsWith(href));

  return (
    <TooltipProvider>
      <div className="flex min-h-dvh flex-col bg-surface">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
            <span className="text-[13px] font-semibold">{brand}</span>
            <nav aria-label="Staff portal" className="hidden items-center gap-1 sm:flex">
              {TABS.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={active(t.href) ? "page" : undefined}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-muted outline-none hover:bg-hover hover:text-ink focus-visible:ring-3 focus-visible:ring-accent/25",
                    active(t.href) && "bg-hover font-medium text-ink",
                  )}
                >
                  <t.icon aria-hidden className="size-4" />
                  {t.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-1">
              <span className="hidden items-center gap-2 pr-1 text-muted sm:flex">
                <Avatar name={name} size="sm" />
                {name}
              </span>
              <ThemeToggle />
              <SignOutButton iconOnly />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl min-w-0 flex-1 px-4 pt-4 pb-24 sm:pb-10">{children}</main>

        <nav
          aria-label="Staff portal"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
        >
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active(t.href) ? "page" : undefined}
              className={cn(
                "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] text-muted outline-none focus-visible:bg-hover",
                active(t.href) && "font-medium text-accent",
              )}
            >
              <t.icon aria-hidden className="size-5" />
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
    </TooltipProvider>
  );
}
