"use client";

import {
  CalendarDays,
  CalendarOff,
  ExternalLink,
  Images,
  KeyRound,
  ListChecks,
  Menu as MenuIcon,
  MessageSquareQuote,
  Plus,
  Scissors,
  Settings,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PILL_SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { SignOutButton } from "./sign-out-button";
import { ThemeToggle } from "./theme";

export type ShellUser = { name: string; email: string; role: string };

type NavItem = { href: string; label: string; icon: LucideIcon; ownerOnly?: boolean };

/** Sidebar, grouped. Owner-only items are hidden from the front desk (the server also enforces it). */
const SECTIONS: { title: string | null; items: NavItem[] }[] = [
  {
    title: null,
    items: [
      { href: "/admin/today", label: "Calendar", icon: CalendarDays },
      { href: "/admin/bookings", label: "Bookings", icon: ListChecks },
      { href: "/admin/bookings/new", label: "New booking", icon: Plus },
    ],
  },
  {
    title: "Salon",
    items: [
      { href: "/admin/staff", label: "Artists", icon: Users },
      { href: "/admin/services", label: "Services & prices", icon: Scissors, ownerOnly: true },
      { href: "/admin/closures", label: "Closures", icon: CalendarOff },
      { href: "/admin/settings", label: "Settings", icon: Settings, ownerOnly: true },
    ],
  },
  {
    title: "Website",
    items: [
      { href: "/admin/portfolio", label: "Portfolio", icon: Images },
      { href: "/admin/instagram", label: "Instagram", icon: Video },
      { href: "/admin/reviews", label: "Reviews", icon: MessageSquareQuote },
    ],
  },
  { title: "Admin", items: [{ href: "/admin/team", label: "Team logins", icon: KeyRound, ownerOnly: true }] },
];

const NAV = SECTIONS.flatMap((s) => s.items);

const roleLabel: Record<string, string> = { owner: "Owner", receptionist: "Front desk", staff: "Artist" };

function isActive(pathname: string, href: string) {
  // Most specific match wins, so "/admin/bookings/new" doesn't also light up "Bookings".
  const matches = NAV.filter((n) => pathname === n.href || pathname.startsWith(`${n.href}/`));
  const best = matches.sort((a, b) => b.href.length - a.href.length)[0];
  return best?.href === href;
}

function NavList({ role, onNavigate }: { role: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const groupId = useId();
  const sections = SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => !i.ownerOnly || role === "owner") })).filter((s) => s.items.length);
  return (
    <LayoutGroup id={groupId}>
      {sections.map((section, si) => (
      <div key={section.title ?? si} className={si > 0 ? "mt-4" : undefined}>
      {section.title && <p className="flex h-5 items-center px-2.5 text-[11px] font-medium text-muted">{section.title}</p>}
      <ul className="space-y-0.5">
        {section.items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative isolate flex h-8 items-center gap-2.5 rounded-lg px-3 text-[13px] outline-none transition-colors",
                  "focus-visible:ring-3 focus-visible:ring-accent/25",
                  active ? "font-medium text-ink" : "text-ink/80 hover:text-ink",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    aria-hidden
                    transition={reduce ? { duration: 0 } : PILL_SPRING}
                    className="absolute inset-0 -z-10 rounded-[inherit] bg-surface shadow-[0_1px_2px_rgb(0_0_0/.06),inset_0_0_0_1px_var(--border)]"
                  />
                )}
                <Icon aria-hidden className="size-4 shrink-0 text-muted" />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      </div>
      ))}
    </LayoutGroup>
  );
}

function SidebarBody({ user, brand, onNavigate }: { user: ShellUser; brand: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2.5 px-[14px]">
        <span className="flex size-7 items-center justify-center rounded-lg bg-ink text-[13px] font-semibold text-surface">
          {brand.slice(0, 1)}
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[13px] font-semibold">{brand}</p>
          <p className="truncate text-[11px] text-muted">Admin</p>
        </div>
      </div>
      <nav aria-label="Admin" className="flex-1 overflow-y-auto px-2 py-2">
        <NavList role={user.role} onNavigate={onNavigate} />
        <div className="mt-4 border-t border-line pt-3">
          <a
            href="/"
            target="_blank"
            rel="noopener"
            className="flex h-8 items-center gap-2.5 rounded-lg px-3 text-[13px] text-muted hover:bg-hover hover:text-ink"
          >
            <ExternalLink aria-hidden className="size-4" /> View website
          </a>
        </div>
      </nav>
      <div className="flex items-center gap-2 border-t border-line p-3">
        <Avatar name={user.name} size="md" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[13px] font-medium">{user.name}</p>
          <p className="truncate text-[11px] text-muted">{roleLabel[user.role] ?? user.role}</p>
        </div>
        <ThemeToggle />
        <SignOutButton iconOnly />
      </div>
    </div>
  );
}

/** DESIGN.md §5 Shell: fixed sidebar on desktop, drawer below lg. */
export function AdminShell({ user, brand, children }: { user: ShellUser; brand: string; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <TooltipProvider>
      <div className="min-h-dvh lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-dvh border-r border-line bg-canvas lg:block">
          <SidebarBody user={user} brand={brand} />
        </aside>

        <div className="flex min-w-0 flex-col">
          <div className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur-md lg:hidden">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <MenuIcon />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" title="Menu" hideTitle className="bg-canvas">
                <div className="-mx-4 h-full">
                  {/* Close the drawer only when a page link is chosen, not on theme/sign-out taps. */}
                  <SidebarBody user={user} brand={brand} onNavigate={() => setMenuOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <span className="text-[13px] font-semibold">{brand}</span>
          </div>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </TooltipProvider>
  );
}

/** DESIGN.md §5 page header: 15px title, optional actions. */
export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-2.5 sm:px-6">
      <div className="min-w-0">
        <h1 className="truncate text-[15px] font-semibold tracking-[-0.01em]">{title}</h1>
        {description && <p className="truncate text-[12px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
    </header>
  );
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-4 py-5 sm:px-6", className)}>{children}</div>;
}
