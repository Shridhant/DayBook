"use client";

import { Bell, BellOff, CalendarCheck, CalendarClock, CalendarOff, CircleAlert, CircleX, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/menu";
import { formatDate, formatInstantTime, istToday, toIst } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { AdminNotification } from "@/server/admin/notifications-admin";

const POLL_MS = 30_000;
const SOUND_KEY = "daybook-notify-sound";

const ICON = {
  booking_confirmed: CalendarCheck,
  payment_review: CircleAlert,
  booking_cancelled: CircleX,
  leave_requested: CalendarOff,
  refund_failed: Undo2,
  booking_rescheduled: CalendarClock,
} as const;
const TONE = {
  booking_confirmed: "text-success",
  payment_review: "text-warning",
  booking_cancelled: "text-muted",
  leave_requested: "text-warning",
  refund_failed: "text-danger",
  booking_rescheduled: "text-accent",
} as const;

/** Short two-note chime via Web Audio (no audio file to load). Browsers allow it after any click. */
function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + i * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.12 + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.3);
    });
    setTimeout(() => ctx.close(), 800);
  } catch {
    // No audio available: silently skip.
  }
}

function readSoundPref() {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  const { date } = toIst(d);
  return date === istToday() ? formatInstantTime(d) : `${formatDate(date)}, ${formatInstantTime(d)}`;
}

type NotificationsState = {
  data: { unread: number; items: AdminNotification[] } | null;
  sound: boolean;
  toggleSound: () => void;
  markRead: (body: { all: true } | { ids: string[] }) => Promise<void>;
};

const NotificationsContext = createContext<NotificationsState | null>(null);

/**
 * One poller for the whole admin (the sidebar and mobile bar both show a bell, but there must be a
 * single fetch loop and a single chime). Polls while the tab is visible and on returning to it.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<{ unread: number; items: AdminNotification[] } | null>(null);
  // Only shown inside the popover (never server-rendered), so reading storage up front is safe.
  const [sound, setSound] = useState(readSoundPref);
  const lastNewest = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const next = (await response.json()) as { unread: number; items: AdminNotification[] };
      const newest = next.items[0];
      // Chime only for genuinely new unread items after the first load.
      if (lastNewest.current !== null && newest && newest.id !== lastNewest.current && !newest.read && readSoundPref()) chime();
      lastNewest.current = newest?.id ?? "";
      setData(next);
    } catch {
      // Offline or server restarting: keep the last state, try again next tick.
    }
  }, []);

  useEffect(() => {
    // First load on the next tick (state is only set after the fetch resolves anyway).
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => document.visibilityState === "visible" && void load(), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const markRead = useCallback(
    async (body: { all: true } | { ids: string[] }) => {
      await fetch("/api/admin/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      await load();
    },
    [load],
  );

  const toggleSound = useCallback(() => {
    setSound((current) => {
      const next = !current;
      try {
        localStorage.setItem(SOUND_KEY, next ? "on" : "off");
      } catch {
        // Storage blocked: the setting lasts for this page view only.
      }
      if (next) chime();
      return next;
    });
  }, []);

  return <NotificationsContext value={{ data, sound, toggleSound, markRead }}>{children}</NotificationsContext>;
}

/** Bell button + popover. Must be inside NotificationsProvider. */
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("NotificationBell must be inside NotificationsProvider");
  const { data, sound, toggleSound, markRead } = ctx;

  const unread = data?.unread ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
          <Bell />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white tabular-nums">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(360px,calc(100vw-24px))] p-0">
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <p className="font-semibold">Notifications</p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggleSound} aria-label={sound ? "Mute the new-booking sound" : "Turn on the new-booking sound"}>
              {sound ? <Bell /> : <BellOff />}
            </Button>
            <Button variant="ghost" size="sm" disabled={!unread} onClick={() => markRead({ all: true })}>
              Mark all read
            </Button>
          </div>
        </div>
        <ul className="thin-scroll max-h-[min(60vh,420px)] overflow-y-auto">
          {!data ? (
            <li className="px-3 py-6 text-center text-muted">Loading…</li>
          ) : data.items.length === 0 ? (
            <li className="px-3 py-6 text-center text-muted">Nothing yet. New online bookings show up here.</li>
          ) : (
            data.items.map((n) => {
              const Icon = ICON[n.type];
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.read) void markRead({ ids: [n.id] });
                      setOpen(false);
                      if (n.type === "leave_requested") router.push("/admin/staff#leave-requests");
                      else if (n.bookingCode) router.push(`/admin/bookings?q=${encodeURIComponent(n.bookingCode)}`);
                    }}
                    className={cn("flex w-full gap-2.5 px-3 py-2.5 text-left hover:bg-hover", !n.read && "bg-accent-soft/40")}
                  >
                    <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", TONE[n.type])} />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate", !n.read && "font-medium")}>{n.title}</span>
                      {n.body && <span className="line-clamp-2 block text-xs text-muted">{n.body}</span>}
                      <span className="block text-[11px] text-muted tabular-nums">{timeLabel(n.createdAt)}</span>
                    </span>
                    {!n.read && <span aria-label="Unread" className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
