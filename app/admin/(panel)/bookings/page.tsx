import type { Metadata } from "next";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/admin/admin-shell";
import { BookingsTable } from "@/components/admin/bookings-table";
import { DateField } from "@/components/ui/calendar";
import { STATUS_LABEL } from "@/components/admin/booking-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/menu";
import type { BookingStatus } from "@/lib/booking-status";
import { isDateKey } from "@/lib/time";
import { requirePageUser } from "@/server/admin/auth";
import { BOOKING_SORTS, listBookings, PAGE_SIZE, type BookingFilters, type BookingSort } from "@/server/admin/bookings";

export const metadata: Metadata = { title: "Bookings" };

const STATUSES: BookingStatus[] = ["pending", "confirmed", "completed", "no_show", "cancelled"];

const SORT_LABEL: Record<BookingSort, string> = {
  upcoming: "Upcoming first",
  newest: "Newest booked",
  latest: "All, latest date",
};

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function BookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  await requirePageUser();
  const sp = await searchParams;
  const status = one(sp.status);
  const q = one(sp.q)?.slice(0, 80);
  const sort = one(sp.sort);
  const filters: BookingFilters = {
    q,
    // A search looks across all dates unless a sort is picked.
    sort: BOOKING_SORTS.includes(sort as BookingSort) ? (sort as BookingSort) : q ? "newest" : "upcoming",
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
        <form method="get" className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto]">
          <Input name="q" defaultValue={filters.q} placeholder="Name, phone or booking code" aria-label="Search" type="search" />
          <Select
            name="status"
            defaultValue={filters.status ?? ""}
            aria-label="Status"
            options={[
              { value: "", label: "All statuses" },
              { value: "active", label: "Upcoming", hint: "Confirmed + awaiting payment" },
              ...STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
            ]}
          />
          <Select name="sort" defaultValue={filters.sort} aria-label="Sort" options={BOOKING_SORTS.map((s) => ({ value: s, label: SORT_LABEL[s] }))} />
          <DateField name="from" defaultValue={filters.from ?? ""} aria-label="From date" placeholder="From date" clearable />
          <DateField name="to" defaultValue={filters.to ?? ""} aria-label="To date" placeholder="To date" clearable />
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
