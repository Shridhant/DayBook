import type { Metadata } from "next";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/admin/admin-shell";
import { BookingsTable } from "@/components/admin/bookings-table";
import { STATUS_LABEL } from "@/components/admin/booking-ui";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import type { BookingStatus } from "@/lib/booking-status";
import { isDateKey } from "@/lib/time";
import { requirePageUser } from "@/server/admin/auth";
import { listBookings, PAGE_SIZE, type BookingFilters } from "@/server/admin/bookings";

export const metadata: Metadata = { title: "Bookings" };

const STATUSES: BookingStatus[] = ["pending", "confirmed", "completed", "no_show", "cancelled"];

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function BookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  await requirePageUser();
  const sp = await searchParams;
  const status = one(sp.status);
  const filters: BookingFilters = {
    q: one(sp.q)?.slice(0, 80),
    status: status === "active" || STATUSES.includes(status as BookingStatus) ? (status as BookingFilters["status"]) : undefined,
    from: isDateKey(one(sp.from)) ? one(sp.from) : undefined,
    to: isDateKey(one(sp.to)) ? one(sp.to) : undefined,
    page: Math.max(1, Number(one(sp.page)) || 1),
  };
  const { rows, total } = await listBookings(filters);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (page: number) => {
    const params = new URLSearchParams(Object.entries({ ...filters, page: String(page) }).filter(([, v]) => v !== undefined) as [string, string][]);
    return `/admin/bookings?${params}`;
  };

  return (
    <>
      <PageHeader
        title="Bookings"
        description={`${total} booking${total === 1 ? "" : "s"}`}
        actions={
          <Button asChild variant="primary">
            <Link href="/admin/bookings/new">New booking</Link>
          </Button>
        }
      />
      <PageBody>
        <form method="get" className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]">
          <Input name="q" defaultValue={filters.q} placeholder="Name, phone or booking code" aria-label="Search" type="search" />
          <NativeSelect name="status" defaultValue={filters.status ?? ""} aria-label="Status">
            <option value="">All statuses</option>
            <option value="active">Upcoming (confirmed + awaiting payment)</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </NativeSelect>
          <Input name="from" type="date" defaultValue={filters.from} aria-label="From date" />
          <Input name="to" type="date" defaultValue={filters.to} aria-label="To date" />
          <div className="flex gap-1.5">
            <Button type="submit" size="md">
              Filter
            </Button>
            <Button asChild size="md" variant="ghost">
              <Link href="/admin/bookings">Clear</Link>
            </Button>
          </div>
        </form>

        <BookingsTable rows={rows} />

        {pages > 1 && (
          <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-muted">
            <span className="tabular-nums">
              Page {filters.page} of {pages}
            </span>
            <div className="flex gap-1.5">
              {(filters.page ?? 1) > 1 && (
                <Button asChild size="sm">
                  <Link href={pageHref((filters.page ?? 1) - 1)}>Previous</Link>
                </Button>
              )}
              {(filters.page ?? 1) < pages && (
                <Button asChild size="sm">
                  <Link href={pageHref((filters.page ?? 1) + 1)}>Next</Link>
                </Button>
              )}
            </div>
          </nav>
        )}
      </PageBody>
    </>
  );
}
