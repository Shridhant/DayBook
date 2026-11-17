import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/admin/admin-shell";
import { formatRangeLabel } from "@/components/admin/reports/format";
import { ReportFilters } from "@/components/admin/reports/report-filters";
import { ReportView } from "@/components/admin/reports/report-view";
import { REPORT_SOURCES, resolveRange, type ReportSource } from "@/lib/reports";
import { istToday } from "@/lib/time";
import { requirePageUser } from "@/server/admin/auth";
import { OWNER_ONLY } from "@/server/admin/http";
import { getReport, getReportOptions } from "@/server/reports";

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
      <PageHeader title="Reports" description={formatRangeLabel(range)} />
      <PageBody>
        <ReportFilters
          values={{ preset, ...range, staff: staffId ?? "", category: categoryId ?? "", source: source ?? "" }}
          staff={options.staff}
          categories={options.categories}
        />
        <ReportView report={report} today={today} openHours={options.openHours} />
      </PageBody>
    </>
  );
}
