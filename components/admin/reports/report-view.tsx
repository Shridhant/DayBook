import { ArrowDownRight, ArrowUpRight, MessageCircle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { BusyTimes } from "@/components/admin/reports/busy-times";
import { ArtistBars, LegendKey, RevenueChart, Sparkline } from "@/components/admin/reports/charts";
import { formatPercent, formatRangeLabel } from "@/components/admin/reports/format";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/card";
import { formatINR } from "@/lib/money";
import { change, ratio, SOURCE_LABEL, type ReportSource } from "@/lib/reports";
import { site } from "@/lib/site";
import { formatDate, formatDuration, toIst } from "@/lib/time";
import { cn } from "@/lib/utils";
import { WIN_BACK_DAYS, type LeadTimeBucket, type Report, type ReportSummary } from "@/server/reports";

/**
 * The owner's reports page body: KPI cards, a revenue/funnel band, an artists/busy-times/metrics
 * band, then the detailed tables. Server component; only the charts are client components.
 */

const SOURCE_COLOR: Record<ReportSource, string> = { online: "var(--chart-1)", walk_in: "var(--chart-2)", phone: "var(--chart-3)" };
const LEAD_LABEL: Record<LeadTimeBucket, string> = {
  same_day: "Same day",
  "1_day": "Day before",
  "2_3_days": "2–3 days",
  "4_7_days": "4–7 days",
  "8_14_days": "1–2 weeks",
  "15_plus": "2+ weeks",
};

type Metric = {
  label: string;
  value: (s: ReportSummary) => string;
  hint: (s: ReportSummary) => string;
  /** The compared quantity: a "change" metric shows ±%, a "rate" metric shows ± percentage points. */
  measure: (s: ReportSummary) => number | null;
  kind: "change" | "rate";
  upIsGood?: boolean;
};

const avgBill = (s: ReportSummary) => (s.completed ? s.revenuePaise / s.completed : null);
const utilisation = (s: ReportSummary) => ratio(s.bookedMinutes, s.capacityMinutes);
const noShowRate = (s: ReportSummary) => ratio(s.noShows, s.completed + s.noShows);
const cancelRate = (s: ReportSummary) => ratio(s.cancelled, s.bookings + s.cancelled);

/** The "At a glance" list; revenue, bookings and utilisation have their own cards above. */
const GLANCE: Metric[] = [
  {
    label: "Average bill",
    value: (s) => {
      const v = avgBill(s);
      return v === null ? "–" : formatINR(wholeRupees(v));
    },
    hint: () => "Per completed booking",
    measure: avgBill,
    kind: "change",
  },
  {
    label: "Clients served",
    value: (s) => s.clients.toLocaleString("en-IN"),
    hint: (s) => `${s.newClients} new · ${s.clients - s.newClients} returning`,
    measure: (s) => s.clients,
    kind: "change",
  },
  {
    label: "No-show rate",
    value: (s) => formatPercent(noShowRate(s)),
    hint: (s) => (s.keptFromNoShowsPaise > 0 ? `${formatINR(s.keptFromNoShowsPaise)} kept from no-shows` : `${s.noShows} no-shows`),
    measure: noShowRate,
    kind: "rate",
    upIsGood: false,
  },
  {
    label: "Cancellations",
    value: (s) => formatPercent(cancelRate(s)),
    hint: (s) => `${s.cancelled} cancelled`,
    measure: cancelRate,
    kind: "rate",
    upIsGood: false,
  },
  {
    label: "Collected online",
    value: (s) => formatINR(s.collectedPaise),
    hint: (s) => (s.refundedPaise > 0 ? `After ${formatINR(s.refundedPaise)} refunded` : "Booking amounts via Razorpay"),
    measure: (s) => s.collectedPaise,
    kind: "change",
  },
];

export function ReportView({ report, today, openHours }: { report: Report; today: string; openHours: [number, number] }) {
  const { summary: s, comparison } = report;
  const partial = comparison && (comparison.currentRange.from !== report.filters.from || comparison.currentRange.to !== report.filters.to);
  const prevLabel = comparison ? formatRangeLabel(comparison.previousRange) : "";
  const empty = s.bookings === 0 && s.cancelled === 0;
  const delta = (m: Pick<Metric, "measure" | "kind" | "upIsGood">) => {
    if (!comparison) return null;
    const current = m.measure(comparison.current);
    const previous = m.measure(comparison.previous);
    return m.kind === "rate" ? (
      <RateDelta current={current} previous={previous} upIsGood={m.upIsGood} />
    ) : (
      <Delta current={current} previous={previous} upIsGood={m.upIsGood} />
    );
  };
  const util = utilisation(s);

  return (
    <div className="space-y-6">
      {s.unmarked > 0 && (
        <Alert
          size="app"
          tone="warning"
          title={`${s.unmarked} past booking${s.unmarked === 1 ? " isn't" : "s aren't"} marked done or no-show`}
          action={
            <Link href={`/admin/bookings?status=confirmed&to=${today}&sort=latest`} className="font-medium text-accent-hover underline-offset-2 hover:underline">
              Review
            </Link>
          }
        >
          Revenue only counts bookings marked done, so it may be lower than it really was.
        </Alert>
      )}

      <div>
        <div className="grid gap-2 md:grid-cols-3">
          <KpiCard
            label="Revenue"
            value={<Money paise={s.revenuePaise} />}
            delta={delta({ measure: (x) => x.revenuePaise, kind: "change" })}
            hint={s.upcomingPaise > 0 ? `+ ${formatINR(s.upcomingPaise)} still to come` : "Bookings marked done"}
          >
            <Sparkline values={report.trend.map((p) => p.revenuePaise + p.upcomingPaise)} />
          </KpiCard>
          <KpiCard
            label="Bookings"
            value={
              <>
                {s.bookings.toLocaleString("en-IN")}
                <Unit>booked</Unit>
              </>
            }
            delta={delta({ measure: (x) => x.bookings, kind: "change" })}
            hint={`${s.completed} done · ${s.noShows} no-show`}
          >
            <Sparkline values={report.trend.map((p) => p.bookings)} />
          </KpiCard>
          <KpiCard
            label="Chair utilisation"
            value={
              util === null ? (
                "–"
              ) : (
                <>
                  {Math.round(util * 100)}
                  <Unit>%</Unit>
                </>
              )
            }
            delta={delta({ measure: utilisation, kind: "rate" })}
            hint={`${formatHours(s.bookedMinutes)} booked of ${formatHours(s.capacityMinutes)} on shift`}
          >
            <Meter value={util} />
          </KpiCard>
        </div>
        <p className="mt-2 text-xs text-muted">
          {comparison
            ? partial
              ? `Changes compare the days so far (${formatRangeLabel(comparison.currentRange)}) with ${prevLabel}.`
              : `Changes compare with ${prevLabel}.`
            : "This period hasn't started yet, so there's nothing to compare."}
        </p>
      </div>

      {empty ? (
        <EmptyState title="No bookings in this period">Try a longer period or clear the filters.</EmptyState>
      ) : (
        <>
          <div className="grid gap-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Panel
              title="Revenue over time"
              description={`Per ${report.bucket}. Service value of bookings marked done; counter payments aren't recorded separately.`}
            >
              <RevenueChart points={report.trend} previous={report.previousTrend} bucket={report.bucket} today={today} />
            </Panel>
            <Panel title="From booking to chair" description="What happened to this period's bookings.">
              <Funnel summary={s} />
            </Panel>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            <Panel title="Artist utilisation" description="Booked time as a share of shift time.">
              <ArtistBars
                average={util}
                artists={report.artists.map((a) => ({
                  id: a.id,
                  name: a.name,
                  photoPath: a.photoPath,
                  utilisation: ratio(a.bookedMinutes, a.capacityMinutes),
                  bookedMinutes: a.bookedMinutes,
                  bookings: a.bookings,
                }))}
              />
            </Panel>
            <Panel title="Busiest times" description="Bookings by day and starting hour. Tap to explore.">
              <BusyTimes cells={report.heatmap} openHours={openHours} />
            </Panel>
            <Panel title="At a glance" className="md:col-span-2 xl:col-span-1">
              <ul className="divide-y divide-line">
                {GLANCE.map((m) => (
                  <li key={m.label} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-[13px]">{m.label}</p>
                      <p className="truncate text-xs text-muted">{m.hint(s)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[13px] font-semibold tabular-nums">{m.value(s)}</p>
                      <div className="text-[11px]">{delta(m)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <div className="grid gap-2 lg:grid-cols-2">
            <Panel title="How clients book" description="Share of bookings by channel, with the value booked and no-show rate.">
              <ChannelBreakdown report={report} />
            </Panel>
            <Panel title="How far ahead clients book" description="Online and phone bookings, by days between booking and appointment.">
              <BarList
                rows={report.leadTime.map((r) => ({ key: r.bucket, label: LEAD_LABEL[r.bucket], value: r.bookings, display: r.bookings.toLocaleString("en-IN") }))}
                total={report.leadTime.reduce((t, r) => t + r.bookings, 0)}
                showShare
              />
            </Panel>
          </div>

          <div className="grid gap-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <Panel title="Revenue by category">
              <BarList
                rows={report.categories.map((c) => ({ key: c.id, label: c.name, value: c.revenuePaise, display: formatINR(c.revenuePaise), sub: `${c.bookings} bookings` }))}
                total={report.categories.reduce((t, c) => t + c.revenuePaise, 0)}
                showShare
              />
            </Panel>
            <Panel title="Services" description="Most revenue first.">
              <ServicesTable report={report} />
            </Panel>
          </div>

          <Panel title="Artists" description="Utilisation is booked time as a share of shift time (after leave and closures).">
            <ArtistsTable report={report} />
          </Panel>
        </>
      )}

      <div className="grid gap-2 lg:grid-cols-2">
        {!empty && (
          <Panel title="Top clients" description="By spend in this period.">
            <NewVsReturning summary={s} />
            <ClientsTable rows={report.topClients.map((c) => ({ ...c, detail: `${c.visits} visit${c.visits === 1 ? "" : "s"}` }))} />
          </Panel>
        )}
        <Panel
          title="Regulars to win back"
          description={`Two or more visits, none in the last ${WIN_BACK_DAYS} days and nothing booked. Not limited to the period above.`}
        >
          {report.winBack.length === 0 ? (
            <p className="text-[13px] text-muted">No regulars have drifted away. Nice.</p>
          ) : (
            <ClientsTable
              rows={report.winBack.map((c) => ({ ...c, detail: c.favourite ? `Usually ${c.favourite}` : `${c.visits} visits` }))}
              winBack
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ---------- Building blocks ---------- */

/** Flat white card on the canvas: hairline border, a whisper of shadow, compact padding. */
function Panel({
  title,
  description,
  actions,
  className,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgb(0_0_0/0.03)]", className)}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

function KpiCard({ label, value, delta, hint, children }: { label: string; value: ReactNode; delta: ReactNode; hint: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgb(0_0_0/0.03)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        {delta}
      </div>
      <p className="mt-2 truncate text-[28px] leading-9 font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-0.5 truncate text-xs text-muted">{hint}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Unit({ children }: { children: ReactNode }) {
  return <span className="ml-1 text-sm font-medium tracking-normal text-muted">{children}</span>;
}

/** "₹1,24,500" with the rupee sign set small, like a unit. */
function Money({ paise }: { paise: number }) {
  const text = formatINR(paise);
  return text.startsWith("₹") ? (
    <>
      <span className="mr-0.5 text-lg font-medium text-muted">₹</span>
      {text.slice(1)}
    </>
  ) : (
    <>{text}</>
  );
}

function Meter({ value }: { value: number | null }) {
  const pct = value === null ? 0 : Math.min(100, value * 100);
  return (
    <div aria-hidden className="flex h-10 items-end">
      <div className="flex h-2 w-full gap-[3px]">
        {Array.from({ length: 20 }, (_, i) => (
          <span key={i} className={cn("h-full flex-1 rounded-[2px]", (i + 1) * 5 <= pct + 2.5 ? "bg-chart-1" : "bg-hover")} />
        ))}
      </div>
    </div>
  );
}

/**
 * Booked → not cancelled → done, as tapering bands with value pills. The gap between "not
 * cancelled" and "done" isn't all loss: it includes no-shows and bookings still to come or unmarked.
 */
function Funnel({ summary: s }: { summary: ReportSummary }) {
  const booked = s.bookings + s.cancelled;
  const open = Math.max(0, s.bookings - s.completed - s.noShows);
  const stages = [
    { label: "Booked", value: booked, tone: 100 },
    { label: "Not cancelled", value: s.bookings, tone: 62 },
    { label: "Done", value: s.completed, tone: 34 },
  ];
  const w = (v: number) => (booked ? Math.max(6, (v / booked) * 100) : 0);
  return (
    <div>
      <div className="space-y-0">
        {stages.map((st, i) => {
          const next = stages[i + 1];
          return (
            <div key={st.label}>
              <div className="mb-1 flex items-baseline justify-between text-xs">
                <span className="text-muted">{st.label}</span>
                <span className="text-muted tabular-nums">{formatPercent(ratio(st.value, booked))}</span>
              </div>
              <div className="relative flex h-8 justify-center">
                <div
                  className="flex h-full items-center justify-center rounded-md"
                  style={{ width: `${w(st.value)}%`, background: `color-mix(in oklab, var(--chart-1) ${st.tone}%, var(--background))` }}
                >
                  <span className="rounded-full bg-surface/95 px-2 text-[11px] leading-5 font-semibold tabular-nums shadow-[0_1px_2px_rgb(0_0_0/0.08)]">
                    {st.value.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
              {next && (
                <svg aria-hidden viewBox="0 0 100 10" preserveAspectRatio="none" className="block h-3 w-full">
                  <polygon
                    points={`${50 - w(st.value) / 2},0 ${50 + w(st.value) / 2},0 ${50 + w(next.value) / 2},10 ${50 - w(next.value) / 2},10`}
                    fill="color-mix(in oklab, var(--chart-1) 14%, var(--background))"
                  />
                </svg>
              )}
            </div>
          );
        })}
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-xs">
        <FunnelNote label="Cancelled" value={s.cancelled} />
        <FunnelNote label="No-show" value={s.noShows} />
        <FunnelNote label="Still open" value={open} title="Still to come, or past and not marked yet" />
      </dl>
    </div>
  );
}

function FunnelNote({ label, value, title }: { label: string; value: number; title?: string }) {
  return (
    <div title={title}>
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold tabular-nums">{value.toLocaleString("en-IN")}</dd>
    </div>
  );
}

/** Signed change vs the comparison period: a small tinted badge, coloured by whether the move is good. */
function DeltaText({ text, up, good }: { text: string; up: boolean | null; good: boolean | null }) {
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-0.5 rounded-md px-1.5 text-[11px] font-medium tabular-nums",
        good === null ? "bg-hover text-muted" : good ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
      )}
    >
      {up !== null && <Icon aria-hidden className="size-3" />}
      {text}
    </span>
  );
}

function Delta({ current, previous, upIsGood = true }: { current: number | null; previous: number | null; upIsGood?: boolean }) {
  const c = current === null || previous === null ? null : change(current, previous);
  if (c === null) return <span className="text-[11px] text-muted">No comparison</span>;
  if (Math.abs(c) < 0.005) return <DeltaText text="No change" up={null} good={null} />;
  const up = c > 0;
  return <DeltaText text={`${up ? "+" : "−"}${formatPercent(Math.abs(c))}`} up={up} good={up === upIsGood} />;
}

/** Change of a rate in percentage points ("+2.1 pts"), since a % change of a % confuses. */
function RateDelta({ current, previous, upIsGood = true }: { current: number | null; previous: number | null; upIsGood?: boolean }) {
  if (current === null || previous === null) return <span className="text-[11px] text-muted">No comparison</span>;
  const pts = (current - previous) * 100;
  if (Math.abs(pts) < 0.05) return <DeltaText text="No change" up={null} good={null} />;
  const up = pts > 0;
  return <DeltaText text={`${up ? "+" : "−"}${Math.abs(pts).toFixed(1)} pts`} up={up} good={up === upIsGood} />;
}

/** An average in paise, rounded to whole rupees for display. */
function wholeRupees(paise: number): number {
  return Math.round(paise / 100) * 100;
}

function formatHours(minutes: number): string {
  return minutes < 600 ? formatDuration(minutes) : `${Math.round(minutes / 60).toLocaleString("en-IN")}h`;
}

/* ---------- Bars and tables ---------- */

type BarRow = { key: string; label: string; value: number; display: string; sub?: string; color?: string };

/** Horizontal bars, values printed beside them (no tooltip needed). */
function BarList({ rows, total, showShare = false }: { rows: BarRow[]; total: number; showShare?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-[13px] text-muted">Nothing in this period.</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate">
              {r.label}
              {r.sub && <span className="ml-2 text-xs text-muted">{r.sub}</span>}
            </span>
            <span className="shrink-0 tabular-nums">
              {r.display}
              {showShare && <span className="ml-2 inline-block w-9 text-right text-xs text-muted">{formatPercent(ratio(r.value, total))}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-hover">
            {r.value > 0 && (
              <div className="h-full rounded-full" style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%`, background: r.color ?? "var(--chart-1)" }} />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ChannelBreakdown({ report }: { report: Report }) {
  const rows = (["online", "walk_in", "phone"] as const)
    .map((source) => report.channels.find((c) => c.source === source) ?? { source, bookings: 0, valuePaise: 0, noShows: 0, completed: 0 })
    .filter((r) => r.bookings > 0 || !report.filters.source);
  const total = rows.reduce((t, r) => t + r.bookings, 0);
  return (
    <div>
      {/* One whole split into parts: a thin segmented bar, 2px gaps, legend below. */}
      {total > 0 && (
        <div className="mb-4 flex h-2 gap-0.5" role="img" aria-label={rows.map((r) => `${SOURCE_LABEL[r.source]} ${formatPercent(ratio(r.bookings, total))}`).join(", ")}>
          {rows
            .filter((r) => r.bookings > 0)
            .map((r) => (
              <div key={r.source} className="h-full rounded-full" style={{ width: `${(r.bookings / total) * 100}%`, background: SOURCE_COLOR[r.source] }} />
            ))}
        </div>
      )}
      <table className="w-full text-[13px]">
        <thead className="text-left text-xs text-muted">
          <tr>
            <th className="pb-1.5 font-medium">Channel</th>
            <th className="pb-1.5 text-right font-medium">Bookings</th>
            <th className="pb-1.5 text-right font-medium">Value</th>
            <th className="pb-1.5 text-right font-medium">No-show</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((r) => (
            <tr key={r.source} className="border-t border-line">
              <td className="py-2">
                <LegendKey color={SOURCE_COLOR[r.source]} label={SOURCE_LABEL[r.source]} />
              </td>
              <td className="py-2 text-right">
                {r.bookings}
                <span className="ml-1.5 text-xs text-muted">{formatPercent(ratio(r.bookings, total))}</span>
              </td>
              <td className="py-2 text-right">{formatINR(r.valuePaise)}</td>
              <td className="py-2 text-right">{formatPercent(ratio(r.noShows, r.completed + r.noShows))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TH = "pb-1.5 font-medium whitespace-nowrap";

function ServicesTable({ report }: { report: Report }) {
  const total = report.services.reduce((t, r) => t + r.revenuePaise, 0);
  const max = Math.max(1, ...report.services.map((r) => r.revenuePaise));
  const shown = report.services.slice(0, 10);
  const rest = report.services.slice(10);
  const row = (r: Report["services"][number]) => (
    <tr key={r.id} className="border-t border-line">
      <td className="py-2 pr-3">
        <p>{r.name}</p>
        <p className="text-xs text-muted">{r.category}</p>
      </td>
      <td className="py-2 text-right">{r.bookings}</td>
      <td className="py-2 pl-3 text-right">
        {formatINR(r.revenuePaise)}
        <div className="mt-1 ml-auto h-1 w-20 rounded-full bg-hover">
          <div className="h-full rounded-full bg-chart-1" style={{ width: `${(r.revenuePaise / max) * 100}%` }} />
        </div>
      </td>
      <td className="py-2 text-right text-xs text-muted">{formatPercent(ratio(r.revenuePaise, total))}</td>
    </tr>
  );
  if (report.services.length === 0) return <p className="text-[13px] text-muted">Nothing in this period.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] text-[13px]">
        <thead className="text-left text-xs text-muted">
          <tr>
            <th className={TH}>Service</th>
            <th className={cn(TH, "text-right")}>Booked</th>
            <th className={cn(TH, "text-right")}>Revenue</th>
            <th className={cn(TH, "text-right")}>
              <span className="sr-only">Share</span>
            </th>
          </tr>
        </thead>
        <tbody className="tabular-nums">{shown.map(row)}</tbody>
        {rest.length > 0 && (
          <tbody className="tabular-nums">
            <tr>
              <td colSpan={4} className="pt-2">
                <details className="text-xs text-muted">
                  <summary className="cursor-pointer hover:text-ink">{rest.length} more services</summary>
                  <table className="mt-1 w-full text-[13px] text-ink">
                    <tbody className="tabular-nums">{rest.map(row)}</tbody>
                  </table>
                </details>
              </td>
            </tr>
          </tbody>
        )}
      </table>
    </div>
  );
}

function ArtistsTable({ report }: { report: Report }) {
  if (report.artists.length === 0) return <p className="text-[13px] text-muted">No artists.</p>;
  const maxRevenue = Math.max(1, ...report.artists.map((a) => a.revenuePaise));
  return (
    <div className="thin-scroll overflow-x-auto">
      <table className="w-full min-w-[680px] text-[13px]">
        <thead className="text-left text-xs text-muted">
          <tr>
            <th className={TH}>Artist</th>
            <th className={cn(TH, "text-right")}>Bookings</th>
            <th className={cn(TH, "pl-6")}>Revenue</th>
            <th className={cn(TH, "text-right")}>Avg bill</th>
            <th className={cn(TH, "pl-6")}>Utilisation</th>
            <th className={cn(TH, "text-right")}>No-show</th>
            <th className={cn(TH, "text-right")}>Clients</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {report.artists.map((a) => {
            const util = ratio(a.bookedMinutes, a.capacityMinutes);
            return (
              <tr key={a.id} className="border-t border-line">
                <td className="py-2 pr-3">
                  <span className="flex items-center gap-2.5">
                    <Avatar name={a.name} src={a.photoPath} size="sm" />
                    <span className="font-medium">{a.name}</span>
                  </span>
                </td>
                <td className="py-2 text-right">{a.bookings}</td>
                <td className="py-2 pl-6">
                  <MiniBar share={a.revenuePaise / maxRevenue} label={formatINR(a.revenuePaise)} />
                </td>
                <td className="py-2 text-right">{a.completed ? formatINR(wholeRupees(a.revenuePaise / a.completed)) : "–"}</td>
                <td className="py-2 pl-6">
                  <MiniBar share={util} label={formatPercent(util)} />
                </td>
                <td className="py-2 text-right">{formatPercent(ratio(a.noShows, a.completed + a.noShows))}</td>
                <td className="py-2 text-right">{a.clients}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** A value with a thin bar beside it, so a column of numbers reads as a chart too. */
function MiniBar({ share, label }: { share: number | null; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-20 shrink-0 rounded-full bg-hover">
        {share !== null && share > 0 && <span className="block h-full rounded-full bg-chart-1" style={{ width: `${Math.min(100, share * 100)}%` }} />}
      </span>
      <span className="min-w-14 text-right">{label}</span>
    </span>
  );
}

function NewVsReturning({ summary: s }: { summary: ReportSummary }) {
  const returning = s.clients - s.newClients;
  if (s.clients === 0) return null;
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex h-2 gap-0.5" role="img" aria-label={`${s.newClients} new clients, ${returning} returning`}>
        {s.newClients > 0 && <div className="h-full rounded-full bg-chart-1" style={{ width: `${(s.newClients / s.clients) * 100}%` }} />}
        {returning > 0 && <div className="h-full rounded-full bg-chart-2" style={{ width: `${(returning / s.clients) * 100}%` }} />}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <LegendKey color="var(--chart-1)" label={`${s.newClients} new (first visit)`} />
        <LegendKey color="var(--chart-2)" label={`${returning} returning`} />
      </div>
    </div>
  );
}

type ClientTableRow = { id: string; name: string; phone: string; spentPaise: number; lastVisit: Date; detail: string };

function ClientsTable({ rows, winBack = false }: { rows: ClientTableRow[]; winBack?: boolean }) {
  if (rows.length === 0) return <p className="text-[13px] text-muted">No completed visits in this period.</p>;
  return (
    <ul className="divide-y divide-line">
      {rows.map((c) => (
        <li key={c.id} className="flex items-center gap-3 py-2.5 text-[13px]">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{c.name}</p>
            <p className="truncate text-xs text-muted">
              {c.detail} · last {formatDate(toIst(c.lastVisit).date, { year: winBack })}
            </p>
          </div>
          <span className="shrink-0 tabular-nums">{formatINR(c.spentPaise)}</span>
          {winBack && (
            <a
              href={`https://wa.me/91${c.phone}?text=${encodeURIComponent(`Hi ${c.name.split(" ")[0]}! It's been a while. We'd love to see you again at ${site.name}.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-ink"
              aria-label={`Message ${c.name} on WhatsApp`}
              title="Message on WhatsApp"
            >
              <MessageCircle className="size-4" aria-hidden />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
