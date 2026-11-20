import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/admin/admin-shell";
import { formatRangeLabel, formatTrendLabel } from "@/components/admin/reports/format";
import { ReportFilters } from "@/components/admin/reports/report-filters";
import { ReportView } from "@/components/admin/reports/report-view";
import { PRESET_LABEL, REPORT_SOURCES, resolveRange, type ReportSource } from "@/lib/reports";
import { site } from "@/lib/site";
import { istToday } from "@/lib/time";
import { requirePageUser } from "@/server/admin/auth";
import { OWNER_ONLY } from "@/server/admin/http";
import { getReport, getReportOptions, type Report } from "@/server/reports";

export const metadata: Metadata = { title: "Reports" };

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

/** Owner-only analytics (AGENTS.md §8: reports show revenue, so the front desk doesn't see them). */
export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  await requirePageUser(OWNER_ONLY);
  const sp = await searchParams;
  const today = istToday();
  const { preset, range } = resolveRange({ preset: one(sp.range), from: one(sp.from), to: one(sp.to) }, today);
  const options = await getReportOptions();

  // Unknown ids (stale links) are dropped rather than producing an empty report.
  const staffId = options.staff.some((s) => s.id === one(sp.staff)) ? (one(sp.staff) ?? null) : null;
  const categoryId = options.categories.some((c) => c.id === one(sp.category)) ? (one(sp.category) ?? null) : null;
  const source = REPORT_SOURCES.includes(one(sp.source) as ReportSource) ? (one(sp.source) as ReportSource) : null;

  const report = await getReport({ ...range, staffId, categoryId, source });

  return (
    <>
      <PageHeader title="Reports" />
      <PageBody className="min-h-[calc(100dvh-3.5rem)] bg-canvas">
        <div className="mb-5">
          <nav aria-label="Breadcrumb" className="text-xs text-muted">
            Reports <span aria-hidden className="mx-1">/</span> {PRESET_LABEL[preset]}
          </nav>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-balance">{formatRangeLabel(range)}</h2>
          <p className="mt-1 text-[13px] text-muted">Revenue, bookings and how full the chairs were at {site.name}.</p>
        </div>
        <div className="mb-6">
          <ReportFilters
            values={{ preset, ...range, staff: staffId ?? "", category: categoryId ?? "", source: source ?? "" }}
            staff={options.staff}
            categories={options.categories}
            exportFile={{ name: exportName(range), csv: toCsv(report) }}
          />
        </div>
        <ReportView report={report} today={today} openHours={options.openHours} />
      </PageBody>
    </>
  );
}

function exportName({ from, to }: { from: string; to: string }): string {
  const slug = site.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug}-report-${from}-to-${to}.csv`;
}

function cell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const rupees = (paise: number) => (paise / 100).toFixed(2);

/** The report as a spreadsheet: one row per period, then one per artist. Amounts in rupees. */
function toCsv(report: Report): string {
  const rows: (string | number)[][] = [
    ["Period", "Revenue (Rs)", "Still to come (Rs)", "Bookings"],
    ...report.trend.map((p) => [formatTrendLabel(p.key, report.bucket), rupees(p.revenuePaise), rupees(p.upcomingPaise), p.bookings]),
    [],
    ["Artist", "Bookings", "Done", "No-shows", "Revenue (Rs)", "Booked hours", "Shift hours", "Clients"],
    ...report.artists.map((a) => [
      a.name,
      a.bookings,
      a.completed,
      a.noShows,
      rupees(a.revenuePaise),
      (a.bookedMinutes / 60).toFixed(1),
      (a.capacityMinutes / 60).toFixed(1),
      a.clients,
    ]),
  ];
  return rows.map((r) => r.map(cell).join(",")).join("\n");
}
