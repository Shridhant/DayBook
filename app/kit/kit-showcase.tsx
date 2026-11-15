"use client";

import {
  CalendarDays,
  Copy,
  IndianRupee,
  Inbox,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Sun,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Chip, Code, Count, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, Section, Stat } from "@/components/ui/card";
import { DateTile, FilterChip, OptionCard, SlotChip } from "@/components/ui/choice";
import { ConfirmDialog, Dialog, DialogClose, DialogContent, DialogTrigger, Sheet, SheetContent, SheetTrigger } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/menu";
import { Accent, DisplayTitle, Eyebrow, Lead, PageSection, SectionHeader } from "@/components/ui/page-section";
import { Rating } from "@/components/ui/rating";
import { Skeleton } from "@/components/ui/skeleton";
import { Reveal } from "@/components/ui/reveal";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { Checkbox, Switch } from "@/components/ui/toggle";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Public surface (DESIGN.md §11)                                       */
/* ------------------------------------------------------------------ */

const categories = [
  { value: "all", label: "All" },
  { value: "gel", label: "Gel" },
  { value: "extensions", label: "Extensions" },
  { value: "art", label: "Nail art" },
  { value: "pedicure", label: "Pedicure" },
] as const;

const services = [
  { id: "gel-mani", name: "Gel polish manicure", minutes: 60, price: 1200 },
  { id: "ext", name: "Gel extensions (full set)", minutes: 120, price: 2500 },
  { id: "art", name: "Nail art (per set)", minutes: 45, price: 800 },
];

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function PublicKit() {
  const [cat, setCat] = useState<string>("all");
  const [filter, setFilter] = useState("all");
  const [picked, setPicked] = useState<string[]>(["gel-mani"]);
  const [staff, setStaff] = useState("any");
  const [date, setDate] = useState(1);
  const [slot, setSlot] = useState("4:30 pm");
  const toast = useToast();

  return (
    <>
      <PageSection>
        <Eyebrow>Nail studio · Gurugram</Eyebrow>
        <DisplayTitle className="mt-3">
          Nails that get <Accent>noticed</Accent>.
        </DisplayTitle>
        <Lead className="mt-5">Gel, extensions and hand-painted art by a team of 12 artists. Book online in under a minute.</Lead>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button variant="primary" size="pub-lg" onClick={() => toast({ title: "Booking flow coming soon", tone: "info" })}>
            Book an appointment
          </Button>
          <Button size="pub-lg">See our work</Button>
        </div>
        <div className="mt-6 flex items-center gap-2 text-[14px] text-muted">
          <Rating value={4.9} /> <span className="font-medium text-ink">4.9</span> on Google · 2,000+ clients
        </div>
      </PageSection>

      <PageSection tone="canvas">
        <SectionHeader eyebrow="Services" title="Menu & prices" lead="Transparent pricing. Pay a small amount to book; the rest at the studio." />
        <Tabs label="Service categories" size="public" items={[...categories]} value={cat} onValueChange={setCat} />
        <ul className="mt-6 grid gap-x-10 lg:grid-cols-2">
          {services.map((s) => (
            <li key={s.id} className="flex items-center gap-4 border-b border-line py-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-[18px] font-semibold tracking-[-0.01em]">{s.name}</h3>
                <p className="text-[14px] text-muted">{s.minutes} min</p>
              </div>
              <span className="font-semibold tabular-nums">{inr.format(s.price)}</span>
              <Button variant="ghost" size="pub-sm">
                Book
              </Button>
            </li>
          ))}
        </ul>
      </PageSection>

      <PageSection>
        <SectionHeader eyebrow="Portfolio" title="Recent work" align="center" />
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {categories.map((c) => (
            <FilterChip key={c.value} selected={filter === c.value} onClick={() => setFilter(c.value)}>
              {c.label}
            </FilterChip>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Reveal key={i} index={i}>
              <div
                className="aspect-[4/5] rounded-2xl bg-canvas"
                style={{ backgroundImage: `linear-gradient(${140 + i * 25}deg, var(--accent-soft), var(--subtle))` }}
              />
            </Reveal>
          ))}
        </div>
      </PageSection>

      <PageSection tone="canvas">
        <SectionHeader eyebrow="Booking flow" title="Controls" />
        <div className="grid gap-10 lg:grid-cols-2">
          <Group title="Service rows (multi-select)">
            <div className="space-y-2">
              {services.map((s) => {
                const on = picked.includes(s.id);
                return (
                  <OptionCard
                    key={s.id}
                    selected={on}
                    onClick={() => setPicked(on ? picked.filter((p) => p !== s.id) : [...picked, s.id])}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[16px] font-medium">{s.name}</p>
                      <p className="text-[14px] text-muted">{s.minutes} min</p>
                    </div>
                    <span className="font-semibold tabular-nums">{inr.format(s.price)}</span>
                  </OptionCard>
                );
              })}
            </div>
          </Group>

          <Group title="Technician">
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "any", name: "Any available", sub: "Fastest slot" },
                { id: "riya", name: "Riya Sharma", sub: "Extensions, art" },
                { id: "meera", name: "Meera Kapoor", sub: "Gel, pedicure" },
                { id: "anjali", name: "Anjali Rao", sub: "Nail art" },
              ].map((t) => (
                <OptionCard key={t.id} layout="stack" indicator="none" selected={staff === t.id} onClick={() => setStaff(t.id)}>
                  {t.id === "any" ? (
                    <span className="flex size-14 items-center justify-center rounded-full bg-hover">
                      <Sparkles className="size-6 text-accent-hover" />
                    </span>
                  ) : (
                    <Avatar name={t.name} size="lg" />
                  )}
                  <span>
                    <span className="block text-[15px] font-medium">{t.name}</span>
                    <span className="block text-[13px] text-muted">{t.sub}</span>
                  </span>
                </OptionCard>
              ))}
            </div>
          </Group>

          <Group title="Date strip + time slots">
            <div className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4">
              {["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"].map((d, i) => (
                <DateTile key={d} weekday={d} day={15 + i} selected={date === i} disabled={d === "Tue"} onClick={() => setDate(i)} />
              ))}
            </div>
            <p className="pt-2 text-[12px] font-medium uppercase tracking-[0.12em] text-accent-hover">Afternoon</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {["12:00 pm", "12:30 pm", "1:00 pm", "3:30 pm", "4:00 pm", "4:30 pm", "5:00 pm", "5:30 pm"].map((t, i) => (
                <SlotChip key={t} selected={slot === t} disabled={i === 3} onClick={() => setSlot(t)}>
                  {t}
                </SlotChip>
              ))}
            </div>
          </Group>

          <Group title="Details form">
            <div className="space-y-4">
              <Field label="Your name" size="public" required>
                <Input autoComplete="name" placeholder="Priya" />
              </Field>
              <Field label="Mobile number" size="public" required error="Enter a 10-digit Indian mobile number">
                <Input prefix="+91" inputMode="numeric" autoComplete="tel-national" defaultValue="98765" />
              </Field>
              <Field label="Anything we should know?" size="public" hint="Optional: design ideas, allergies, etc.">
                <Textarea />
              </Field>
              <Button variant="primary" size="pub-lg" block>
                Pay {inr.format(500)} to confirm
              </Button>
            </div>
          </Group>
        </div>
      </PageSection>

      <PageSection tone="ink">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-end md:justify-between">
          <h2 className="text-[clamp(1.75rem,4.5vw,2.75rem)] font-semibold leading-[1.1] tracking-[-0.025em]">
            Your next set is <Accent>one tap</Accent> away.
          </h2>
          <Button variant="inverse" size="pub-lg">
            Book now
          </Button>
        </div>
      </PageSection>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* App surface (DESIGN.md §1–9)                                          */
/* ------------------------------------------------------------------ */

function AppKit({ dark, onToggleDark }: { dark: boolean; onToggleDark: () => void }) {
  const [tab, setTab] = useState("today");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [notify, setNotify] = useState(true);
  const toast = useToast();

  const rows = [
    { code: "DB-7K2Q", name: "Priya M.", service: "Gel extensions", staff: "Riya", time: "11:00 am", status: "confirmed" as const },
    { code: "DB-7K2R", name: "Sana K.", service: "Spa pedicure", staff: "Meera", time: "12:30 pm", status: "pending" as const },
    { code: "DB-7K2S", name: "Walk-in", service: "Gel manicure", staff: "Anjali", time: "2:00 pm", status: "no_show" as const },
  ];
  const statusTone = { confirmed: "success", pending: "warning", no_show: "danger" } as const;
  const statusLabel = { confirmed: "Confirmed", pending: "Pending", no_show: "No-show" } as const;

  return (
    <div className="surface-app bg-surface text-ink">
      <div className="container-page py-10">
        <div className="mb-6 flex min-h-14 items-center justify-between gap-3 border-b border-line pb-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Admin kit</h2>
            <p className="text-muted">DESIGN.md §1–9 · 13px dense surface</p>
          </div>
          <div className="flex items-center gap-1.5">
            <StatusPill tone="success">Live</StatusPill>
            <Tooltip content={dark ? "Light mode" : "Dark mode"}>
              <Button variant="ghost" size="icon" onClick={onToggleDark} aria-label="Toggle dark mode">
                {dark ? <Sun /> : <Moon />}
              </Button>
            </Tooltip>
          </div>
        </div>

        <div className="space-y-8">
          <Group title="Buttons">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary">
                <Plus /> New booking
              </Button>
              <Button>Secondary</Button>
              <Button variant="muted">Muted</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">
                <Trash2 /> Delete
              </Button>
              <Button variant="primary" size="md">
                Medium
              </Button>
              <Button variant="primary" size="md" loading>
                Saving
              </Button>
              <Button size="icon" aria-label="Edit">
                <Pencil />
              </Button>
            </div>
          </Group>

          <Group title="Chips, counts, codes">
            <div className="flex flex-wrap items-center gap-2">
              <Chip>Neutral</Chip>
              <Chip tone="accent">Extensions</Chip>
              <Chip tone="success">Paid</Chip>
              <Chip tone="warning">Hold 12:41</Chip>
              <Chip tone="danger">Refund due</Chip>
              <Count>12</Count>
              <Code>DB-7K2Q</Code>
              <StatusPill tone="warning">Pending</StatusPill>
            </div>
          </Group>

          <Group title="Stats">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat icon={CalendarDays} label="Bookings today" value={18} total={24} hint="6 slots open" />
              <Stat icon={IndianRupee} label="Collected today" value="₹9,500" hint="19 advances" />
              <Stat icon={Users} label="Staff on shift" value={10} total={12} />
              <Stat icon={Sparkles} label="No-shows (30d)" value="3.1%" hint="↓ 0.8 pts" />
            </div>
          </Group>

          <Group title="Tabs + table">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
                <Tabs
                  label="Booking views"
                  items={[
                    { value: "today", label: "Today", count: 18 },
                    { value: "upcoming", label: "Upcoming", count: 64 },
                    { value: "past", label: "Past" },
                  ]}
                  value={tab}
                  onValueChange={setTab}
                />
                <Menu>
                  <MenuTrigger asChild>
                    <Button size="sm">
                      View <MoreHorizontal />
                    </Button>
                  </MenuTrigger>
                  <MenuContent>
                    <MenuLabel>Show</MenuLabel>
                    <MenuCheckboxItem checked={showCancelled} onCheckedChange={(v) => setShowCancelled(v === true)}>
                      Cancelled bookings
                    </MenuCheckboxItem>
                    <MenuSeparator />
                    <MenuItem onSelect={() => toast({ title: "Exported 18 bookings", tone: "success" })}>
                      <Copy /> Export CSV
                    </MenuItem>
                    <MenuItem tone="danger" onSelect={() => setConfirmOpen(true)}>
                      <Trash2 /> Clear expired holds
                    </MenuItem>
                  </MenuContent>
                </Menu>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="th">Ref</th>
                      <th className="th">Customer</th>
                      <th className="th">Service</th>
                      <th className="th">Artist</th>
                      <th className="th">Time</th>
                      <th className="th">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.code} className="transition-colors hover:bg-canvas/60">
                        <td className="td">
                          <Code>{r.code}</Code>
                        </td>
                        <td className="td">
                          <span className="flex items-center gap-2">
                            <Avatar name={r.name} size="sm" /> {r.name}
                          </span>
                        </td>
                        <td className="td">{r.service}</td>
                        <td className="td">{r.staff}</td>
                        <td className="td tabular-nums">{r.time}</td>
                        <td className="td">
                          <StatusPill tone={statusTone[r.status]}>{statusLabel[r.status]}</StatusPill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </Group>

          <Section icon={IndianRupee} title="Booking amount" description="What customers pay online to confirm a slot.">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Rule">
                <NativeSelect defaultValue="fixed">
                  <option value="fixed">Fixed amount</option>
                  <option value="percent">Percentage of total</option>
                </NativeSelect>
              </Field>
              <Field label="Amount (₹)" hint="Applied unless a service overrides it">
                <Input inputMode="numeric" defaultValue="500" />
              </Field>
              <Field label="Free cancellation window" error="Must be between 0 and 72 hours">
                <Input inputMode="numeric" defaultValue="96" />
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2">
                <Switch checked={notify} onCheckedChange={setNotify} /> Notify owner on every booking
              </label>
              <label className="flex items-center gap-2">
                <Checkbox defaultChecked /> Show customer phone to staff
              </label>
            </div>
          </Section>

          <Group title="Overlays">
            <div className="flex flex-wrap gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button>Open modal</Button>
                </DialogTrigger>
                <DialogContent
                  title="New walk-in booking"
                  description="Creates a confirmed booking without online payment."
                  footer={
                    <>
                      <DialogClose asChild>
                        <Button size="md">Cancel</Button>
                      </DialogClose>
                      <Button size="md" variant="primary">
                        Create booking
                      </Button>
                    </>
                  }
                >
                  <Field label="Customer name">
                    <Input placeholder="Name" />
                  </Field>
                  <Field label="Phone">
                    <Input inputMode="numeric" placeholder="10-digit mobile" />
                  </Field>
                </DialogContent>
              </Dialog>

              <Sheet>
                <SheetTrigger asChild>
                  <Button>Open sheet</Button>
                </SheetTrigger>
                <SheetContent title="Booking DB-7K2Q">
                  <p className="text-muted">Side panel for booking details, staff edits, etc.</p>
                </SheetContent>
              </Sheet>

              <Popover>
                <PopoverTrigger asChild>
                  <Button>Popover</Button>
                </PopoverTrigger>
                <PopoverContent>
                  <p className="font-medium">Riya Sharma</p>
                  <p className="mt-0.5 text-muted">On shift 11:00 am – 8:00 pm · 6 bookings today</p>
                </PopoverContent>
              </Popover>

              <Button onClick={() => toast({ title: "Booking confirmed", description: "DB-7K2Q · Sat 4:30 pm", tone: "success" })}>
                Toast
              </Button>
              <Button onClick={() => toast({ title: "Payment failed", description: "No money was taken.", tone: "error" })}>
                Error toast
              </Button>
              <Button variant="danger" onClick={() => setConfirmOpen(true)}>
                Confirm dialog
              </Button>
            </div>
          </Group>

          <Group title="Alerts + skeletons">
            <div className="grid gap-3 lg:grid-cols-2">
              <Alert size="app" tone="info" title="Heads up">Bookings sync every minute.</Alert>
              <Alert size="app" tone="success" title="Payment captured">₹500 for DB-7K2Q.</Alert>
              <Alert size="app" tone="warning" title="Hold expiring">2 minutes left on this slot.</Alert>
              <Alert size="app" tone="danger" title="Payment failed">No money was taken.</Alert>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </Group>

          <EmptyState
            icon={Inbox}
            title="No bookings yet"
            action={
              <Button variant="primary" size="md">
                <Plus /> New booking
              </Button>
            }
          >
            Bookings made online or added here will show up in this list.
          </EmptyState>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        tone="danger"
        title="Clear expired holds?"
        description="Releases 3 slots held by customers who didn't finish paying."
        confirmLabel="Clear holds"
        onConfirm={async () => {
          await new Promise((r) => setTimeout(r, 800));
          toast({ title: "3 holds cleared", tone: "success" });
        }}
      />
    </div>
  );
}

export function KitShowcase() {
  const [dark, setDark] = useState(false);
  // Theme class lives on <html> so portalled overlays (dialogs, menus, toasts) inherit it.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    return () => document.documentElement.classList.remove("dark");
  }, [dark]);
  return (
    <TooltipProvider>
      <main>
        <PublicKit />
        <AppKit dark={dark} onToggleDark={() => setDark((d) => !d)} />
      </main>
    </TooltipProvider>
  );
}
