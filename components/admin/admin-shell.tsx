"use client";

import {
  Bell,
  CalendarDays,
  CalendarOff,
  ChartColumn,
  ChevronsUpDown,
  ExternalLink,
  Images,
  KeyRound,
  ListChecks,
  LogOut,
  Menu as MenuIcon,
  MessageSquareQuote,
  Moon,
  PanelLeft,
  Plus,
  Scissors,
  Settings,
  Sun,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DemoBanner } from "@/components/demo-banner";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { SIDEBAR_EVENT, SIDEBAR_KEY } from "@/lib/admin-theme";
import { PILL_SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { NotificationBell, NotificationsProvider } from "./notification-bell";
import { useSignOut } from "./sign-out-button";
import { useAdminTheme } from "./theme";

export type ShellUser = { name: string; email: string; role: string };

const ShellUserContext = createContext<ShellUser | null>(null);

/**
 * The signed-in admin user, for hiding controls they can't use (e.g. refunds for the front desk).
 * Display only: every API route checks the role on the server.
 */
export function useShellUser(): ShellUser | null {
  return useContext(ShellUserContext);
}

type NavItem = { href: string; label: string; icon: LucideIcon; ownerOnly?: boolean };

/** Sidebar, grouped. Owner-only items are hidden from the front desk (the server also enforces it). */
const SECTIONS: { title: string | null; items: NavItem[] }[] = [
  {
    title: null,
    items: [
      { href: "/admin/today", label: "Calendar", icon: CalendarDays },
      { href: "/admin/bookings", label: "Bookings", icon: ListChecks },
      { href: "/admin/bookings/new", label: "New booking", icon: Plus },
      { href: "/admin/reports", label: "Reports", icon: ChartColumn, ownerOnly: true },
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

/* ---------- Collapsible desktop sidebar ---------- */

// The <html data-sidebar-collapsed> attribute (set before paint by THEME_SCRIPT) drives the layout
// through CSS (`sidebar-collapsed:` and `rail:` variants), so a collapsed sidebar never flashes open.
// This state only adds what CSS can't: tooltips, labels and menu text.
function subscribeSidebar(onChange: () => void) {
  window.addEventListener(SIDEBAR_EVENT, onChange);
  return () => window.removeEventListener(SIDEBAR_EVENT, onChange);
}
const readCollapsed = () => document.documentElement.hasAttribute("data-sidebar-collapsed");

function useSidebarCollapsed() {
  return useSyncExternalStore(subscribeSidebar, readCollapsed, () => false);
}

function setSidebarCollapsed(collapsed: boolean) {
  document.documentElement.toggleAttribute("data-sidebar-collapsed", collapsed);
  try {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
  } catch {
    // Storage blocked: the choice lasts for this page view only.
  }
  window.dispatchEvent(new Event(SIDEBAR_EVENT));
}

const toggleSidebar = () => setSidebarCollapsed(!readCollapsed());

/** "⌘B" on Apple devices, "Ctrl B" elsewhere. Only rendered on the client (tooltips, menus). */
function shortcutLabel() {
  return /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘B" : "Ctrl B";
}

/*
 * How the rail stays calm: the panel keeps its full width inside an `overflow-hidden` aside whose
 * width animates, so nothing re-wraps mid-animation. Icons sit at a fixed x (centred in the 60px
 * rail) and never move; labels fade and drift 4px; rows shrink to the icon so the active pill does
 * too. Section titles fade but keep their height, so rows don't jump up.
 */
const EXPANDED_W = "w-[232px]";
const DRAWER_EASE = "ease-[cubic-bezier(0.32,0.72,0,1)]";
/** Text that disappears in the rail. `invisible` takes it out of the tab order and hit-testing too. */
const FADE =
  "transition-[opacity,translate,visibility] duration-200 delay-75 ease-out rail:invisible rail:-translate-x-1 rail:opacity-0 rail:delay-0 rail:duration-150 motion-reduce:transition-none";
const ROW =
  "relative isolate flex h-9 w-full items-center gap-3 rounded-lg px-[14px] text-[13px] outline-none focus-visible:ring-3 focus-visible:ring-accent/25 " +
  `transition-[width,color,background-color] duration-300 ${DRAWER_EASE} rail:w-11 motion-reduce:transition-none`;

const SidebarContext = createContext<{ collapsed: boolean } | null>(null);

function isActive(pathname: string, href: string) {
  // Most specific match wins, so "/admin/bookings/new" doesn't also light up "Bookings".
  const matches = NAV.filter((n) => pathname === n.href || pathname.startsWith(`${n.href}/`));
  const best = matches.sort((a, b) => b.href.length - a.href.length)[0];
  return best?.href === href;
}

const roleLabel: Record<string, string> = { owner: "Owner", receptionist: "Front desk", staff: "Artist" };

/** In the rail every row explains itself on hover; expanded rows already show their label. */
function RailTooltip({ label, collapsed, children }: { label: string; collapsed: boolean; children: ReactNode }) {
  return collapsed ? (
    <Tooltip content={label} side="right">
      {children}
    </Tooltip>
  ) : (
    children
  );
}

function NavList({ role, onNavigate, rail = false }: { role: string; onNavigate?: () => void; rail?: boolean }) {
  const pathname = usePathname();
  const collapsed = useSidebarCollapsed() && rail;
  const reduce = useReducedMotion();
  const groupId = useId();
  const sections = SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => !i.ownerOnly || role === "owner") })).filter((s) => s.items.length);
  return (
    <LayoutGroup id={groupId}>
      {sections.map((section, si) => (
        <div key={section.title ?? si} className={si > 0 ? "mt-4" : undefined}>
          {section.title && (
            <p className="relative flex h-6 items-center px-[14px] text-[11px] font-medium text-muted">
              <span className={FADE}>{section.title}</span>
              {/* In the rail a short rule marks where the group starts. */}
              <span aria-hidden className="absolute left-[22px] h-px w-4 bg-line opacity-0 transition-opacity duration-200 rail:opacity-100" />
            </p>
          )}
          <ul className="space-y-0.5">
            {section.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <RailTooltip label={label} collapsed={collapsed}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(ROW, active ? "font-medium text-ink" : "text-ink/75 hover:bg-hover/60 hover:text-ink")}
                    >
                      {active && (
                        <motion.span
                          layoutId="nav-pill"
                          aria-hidden
                          transition={reduce ? { duration: 0 } : PILL_SPRING}
                          className="absolute inset-0 -z-10 rounded-[inherit] bg-surface shadow-[0_1px_2px_rgb(0_0_0/.06),inset_0_0_0_1px_var(--border)]"
                        />
                      )}
                      <Icon aria-hidden className={cn("size-4 shrink-0", active ? "text-ink" : "text-muted")} />
                      {/* Faded (not removed) in the rail, so it stays the link's accessible name. */}
                      <span className={cn("min-w-0 flex-1 truncate", FADE)}>{label}</span>
                    </Link>
                  </RailTooltip>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </LayoutGroup>
  );
}

/** Notifications as the first row: label and count when open, a dot on the icon in the rail. */
function NotificationsRow({ collapsed }: { collapsed: boolean }) {
  return (
    <NotificationBell
      side={collapsed ? "right" : "bottom"}
      align="start"
      trigger={(unread) => (
        <button type="button" className={cn(ROW, "text-ink/75 hover:bg-hover/60 hover:text-ink")} aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
          <span className="relative shrink-0">
            <Bell aria-hidden className="size-4 text-muted" />
            {unread > 0 && (
              <span aria-hidden className="absolute -top-1 -right-1 size-2 rounded-full bg-accent opacity-0 ring-2 ring-canvas transition-opacity duration-200 rail:opacity-100" />
            )}
          </span>
          <span className={cn("min-w-0 flex-1 truncate text-left", FADE)}>Notifications</span>
          {unread > 0 && (
            <span className={cn("rounded-full bg-accent px-1.5 py-px text-[10px] font-semibold text-white tabular-nums", FADE)}>{unread > 99 ? "99+" : unread}</span>
          )}
        </button>
      )}
    />
  );
}

/** The signed-in person; opens their menu (theme, sidebar, website, sign out). */
function AccountMenu({ user, rail, collapsed }: { user: ShellUser; rail: boolean; collapsed: boolean }) {
  const theme = useAdminTheme();
  const { signOut, busy } = useSignOut();
  return (
    <Menu>
      <RailTooltip label={user.name} collapsed={collapsed}>
        <MenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-11 w-full items-center gap-2.5 rounded-xl p-[6px] text-left outline-none hover:bg-hover focus-visible:ring-3 focus-visible:ring-accent/25 data-[state=open]:bg-hover",
              `transition-[width,background-color] duration-300 ${DRAWER_EASE} rail:w-11 motion-reduce:transition-none`,
            )}
            aria-label={`${user.name}, account menu`}
          >
            <Avatar name={user.name} size="md" />
            <span className={cn("min-w-0 flex-1 leading-tight", FADE)}>
              <span className="block truncate text-[13px] font-medium">{user.name}</span>
              <span className="block truncate text-[11px] text-muted">{roleLabel[user.role] ?? user.role}</span>
            </span>
            <ChevronsUpDown aria-hidden className={cn("size-4 shrink-0 text-muted", FADE)} />
          </button>
        </MenuTrigger>
      </RailTooltip>
      <MenuContent side={collapsed ? "right" : "top"} align={collapsed ? "end" : "start"} className="w-60">
        <MenuLabel className="pb-1.5">
          <span className="block truncate text-[13px] font-medium text-ink">{user.name}</span>
          <span className="block truncate font-normal">{user.email}</span>
        </MenuLabel>
        <MenuSeparator />
        <MenuItem onSelect={theme.toggle}>
          {theme.dark ? <Sun /> : <Moon />} {theme.dark ? "Light mode" : "Dark mode"}
        </MenuItem>
        {rail && (
          <MenuItem onSelect={toggleSidebar}>
            <PanelLeft /> {collapsed ? "Expand sidebar" : "Collapse sidebar"}
            <kbd className="ml-auto font-sans text-[11px] text-muted">{shortcutLabel()}</kbd>
          </MenuItem>
        )}
        <MenuItem asChild>
          <a href="/" target="_blank" rel="noopener">
            <ExternalLink /> View website
          </a>
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          disabled={busy}
          onSelect={(event) => {
            event.preventDefault(); // keep the menu while signing out, so the click isn't lost
            void signOut();
          }}
        >
          <LogOut /> {busy ? "Signing out…" : "Sign out"}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function SidebarBody({
  user,
  brand,
  onNavigate,
  rail = false,
}: {
  user: ShellUser;
  brand: string;
  onNavigate?: () => void;
  /** The desktop sidebar, which can collapse to icons; the mobile drawer never does. */
  rail?: boolean;
}) {
  const collapsed = useSidebarCollapsed() && rail;
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2.5 px-4">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-ink text-[13px] font-semibold text-surface">
          {brand.slice(0, 1)}
        </span>
        <div className={cn("min-w-0 flex-1 leading-tight", FADE)}>
          <p className="truncate text-[13px] font-semibold">{brand}</p>
          <p className="truncate text-[11px] text-muted">Admin</p>
        </div>
      </div>
      <nav aria-label="Admin" className="thin-scroll flex-1 overflow-x-hidden overflow-y-auto px-2 pt-1 pb-3">
        {/* The phone drawer has the bell in its top bar already. */}
        {rail && (
          <div className="mb-3">
            <NotificationsRow collapsed={collapsed} />
          </div>
        )}
        <NavList role={user.role} onNavigate={onNavigate} rail={rail} />
      </nav>
      <div className="border-t border-line px-2 py-2">
        <AccountMenu user={user} rail={rail} collapsed={collapsed} />
      </div>
    </div>
  );
}

/** The page header's sidebar toggle (desktop only); also ⌘B / Ctrl B and a click on the sidebar edge. */
function SidebarTrigger() {
  const ctx = useContext(SidebarContext);
  if (!ctx) return null;
  const label = ctx.collapsed ? "Expand sidebar" : "Collapse sidebar";
  return (
    <>
      <Tooltip
        content={
          <span className="flex items-center gap-2">
            {label} <kbd className="font-sans text-muted">{shortcutLabel()}</kbd>
          </span>
        }
        side="bottom"
      >
        <Button variant="ghost" size="icon" className="hidden text-muted hover:text-ink lg:inline-flex" aria-label={label} aria-expanded={!ctx.collapsed} onClick={toggleSidebar}>
          <PanelLeft />
        </Button>
      </Tooltip>
      <span aria-hidden className="hidden h-5 w-px bg-line lg:block" />
    </>
  );
}

/** DESIGN.md §5 Shell: collapsible sidebar on desktop, drawer below lg. */
export function AdminShell({ user, brand, children }: { user: ShellUser; brand: string; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const collapsed = useSidebarCollapsed();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== "b") return;
      if (!window.matchMedia("(min-width: 1024px)").matches) return; // phones use the drawer
      event.preventDefault();
      toggleSidebar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ShellUserContext value={user}>
      <SidebarContext value={{ collapsed }}>
        <TooltipProvider>
          <NotificationsProvider>
            <div data-admin-shell className="min-h-dvh lg:flex">
              <aside
                data-rail
                className={cn(
                  "sticky top-0 hidden h-dvh shrink-0 overflow-hidden border-r border-line bg-canvas lg:block",
                  EXPANDED_W,
                  `sidebar-collapsed:w-[60px] transition-[width] duration-300 ${DRAWER_EASE} motion-reduce:transition-none`,
                )}
              >
                <div className={cn("h-full", EXPANDED_W)}>
                  <SidebarBody user={user} brand={brand} rail />
                </div>
                {/* The edge itself toggles, like a hinge. Mouse only: keyboard users have the header button and ⌘B. */}
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                  title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                  onClick={toggleSidebar}
                  className="absolute inset-y-0 right-0 z-20 w-2 cursor-col-resize outline-none after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-transparent after:transition-colors hover:after:bg-ink/25"
                />
              </aside>

              <div className="flex min-w-0 flex-1 flex-col">
                <DemoBanner />
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
                  <span className="flex-1 text-[13px] font-semibold">{brand}</span>
                  <NotificationBell />
                </div>
                <div className="min-w-0 flex-1">{children}</div>
              </div>
            </div>
          </NotificationsProvider>
        </TooltipProvider>
      </SidebarContext>
    </ShellUserContext>
  );
}

/** DESIGN.md §5 page header: 15px title, optional actions; on desktop it holds the sidebar toggle. */
export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-2.5 sm:px-6 lg:pl-3">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger />
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold tracking-[-0.01em]">{title}</h1>
          {description && <p className="truncate text-[12px] text-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
    </header>
  );
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-4 py-5 sm:px-6", className)}>{children}</div>;
}
