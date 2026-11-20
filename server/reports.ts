import "server-only";
import { sql } from "@/lib/db";
import {
  bucketKeys,
  pickBucket,
  comparisonRanges,
  previousRange,
  type Bucket,
  type DateRange,
  type ReportSource,
} from "@/lib/reports";
import { istDayRange, istToday, type DateKey } from "@/lib/time";

/**
 * Owner reports (AGENTS.md §14, phase 3). Read-only aggregates over bookings, items, payments and
 * shifts. A booking belongs to the period its appointment *starts* in (IST), not when it was made.
 *
 * Money definitions, shown to the owner on the page:
 * - revenue = service value of bookings marked done (price snapshots, so later price changes
 *   don't rewrite history). Money taken at the counter isn't recorded in Daybook.
 * - still to come = confirmed bookings that haven't started yet.
 * - collected online = booking amounts captured by Razorpay minus refunds.
 * With a category filter, values count only that category's services.
 */

export type ReportFilters = DateRange & {
  staffId: string | null;
  categoryId: string | null;
  source: ReportSource | null;
};

export type ReportSummary = {
  revenuePaise: number;
  upcomingPaise: number;
  /** Past confirmed bookings nobody marked done or no-show. */
  unmarked: number;
  bookings: number;
  completed: number;
  noShows: number;
  cancelled: number;
  clients: number;
  newClients: number;
  collectedPaise: number;
  refundedPaise: number;
  /** Booking amounts kept from no-shows. */
  keptFromNoShowsPaise: number;
  bookedMinutes: number;
  capacityMinutes: number;
};

export type TrendPoint = { key: DateKey; revenuePaise: number; upcomingPaise: number; bookings: number };
export type ChannelRow = { source: ReportSource; bookings: number; valuePaise: number; noShows: number; completed: number };
export type LeadTimeRow = { bucket: LeadTimeBucket; bookings: number };
export type HeatCell = { weekday: number; hour: number; bookings: number };
export type ServiceRow = { id: string; name: string; category: string; bookings: number; revenuePaise: number };
export type CategoryRow = { id: string; name: string; bookings: number; revenuePaise: number };
export type ArtistRow = {
  id: string;
  name: string;
  photoPath: string | null;
  bookings: number;
  completed: number;
  noShows: number;
  revenuePaise: number;
  bookedMinutes: number;
  capacityMinutes: number;
  clients: number;
};
export type ClientRow = { id: string; name: string; phone: string; visits: number; spentPaise: number; lastVisit: Date };
export type WinBackRow = ClientRow & { favourite: string | null };

export type Report = {
  filters: ReportFilters;
  bucket: Bucket;
  summary: ReportSummary;
  /** What the KPI deltas compare (see comparisonRanges); null for a period entirely ahead. */
  comparison: { current: ReportSummary; previous: ReportSummary; currentRange: DateRange; previousRange: DateRange } | null;
  trend: TrendPoint[];
  /** The same buckets for the period before (previousRange), for the dotted comparison line; null for a period entirely ahead. */
  previousTrend: TrendPoint[] | null;
  channels: ChannelRow[];
  leadTime: LeadTimeRow[];
  heatmap: HeatCell[];
  services: ServiceRow[];
  categories: CategoryRow[];
  artists: ArtistRow[];
  topClients: ClientRow[];
  winBack: WinBackRow[];
};

export const LEAD_TIME_BUCKETS = ["same_day", "1_day", "2_3_days", "4_7_days", "8_14_days", "15_plus"] as const;
export type LeadTimeBucket = (typeof LEAD_TIME_BUCKETS)[number];

/** Regulars (2+ visits) not seen for this long, with nothing booked, are listed to win back. */
export const WIN_BACK_DAYS = 45;
const ACTIVE = sql`('confirmed', 'completed', 'no_show')`;

function bounds(range: DateRange) {
  return { start: istDayRange(range.from).start, end: istDayRange(range.to).end };
}

/** Bookings in scope with their value; the base of every report query. */
function scoped(f: ReportFilters, range: DateRange) {
  const { start, end } = bounds(range);
  return sql`
    select b.id, b.customer_id, b.staff_id, b.status, b.source, b.starts_at, b.ends_at, b.created_at,
      ${
        f.categoryId
          ? sql`(select coalesce(sum(i.price_snapshot_paise), 0) from booking_items i join services s on s.id = i.service_id
                 where i.booking_id = b.id and s.category_id = ${f.categoryId})`
          : sql`b.total_paise`
      }::float8 as value
    from bookings b
    where b.starts_at >= ${start} and b.starts_at < ${end}
      and b.status in ('confirmed', 'completed', 'no_show', 'cancelled')
      ${f.staffId ? sql`and b.staff_id = ${f.staffId}` : sql``}
      ${f.source ? sql`and b.source = ${f.source}` : sql``}
      ${
        f.categoryId
          ? sql`and exists (select 1 from booking_items i join services s on s.id = i.service_id
                            where i.booking_id = b.id and s.category_id = ${f.categoryId})`
          : sql``
      }`;
}

async function summaryFor(f: ReportFilters, range: DateRange, now: Date): Promise<ReportSummary> {
  const { start } = bounds(range);
  const [row] = await sql<
    {
      revenue: number;
      upcoming: number;
      unmarked: number;
      bookings: number;
      completed: number;
      no_shows: number;
      cancelled: number;
      clients: number;
      new_clients: number;
      collected: number;
      refunded: number;
      kept: number;
      booked_minutes: number;
    }[]
  >`
    with b as (${scoped(f, range)}),
    pay as (
      select p.booking_id, sum(p.amount_paise - p.refunded_paise) as net, sum(p.refunded_paise) as refunded
      from payments p
      where p.status in ('captured', 'refunded', 'partially_refunded') and p.booking_id in (select id from b)
      group by p.booking_id
    ),
    firsts as (
      select customer_id, min(starts_at) as first_at from bookings
      where status = 'completed' and customer_id in (select customer_id from b)
      group by customer_id
    )
    select
      coalesce(sum(b.value) filter (where b.status = 'completed'), 0)::float8 as revenue,
      coalesce(sum(b.value) filter (where b.status = 'confirmed' and b.starts_at >= ${now}), 0)::float8 as upcoming,
      count(*) filter (where b.status = 'confirmed' and b.ends_at < ${now})::int as unmarked,
      count(*) filter (where b.status in ${ACTIVE})::int as bookings,
      count(*) filter (where b.status = 'completed')::int as completed,
      count(*) filter (where b.status = 'no_show')::int as no_shows,
      count(*) filter (where b.status = 'cancelled')::int as cancelled,
      count(distinct b.customer_id) filter (where b.status = 'completed')::int as clients,
      count(distinct b.customer_id) filter (where b.status = 'completed' and f.first_at >= ${start})::int as new_clients,
      coalesce(sum(pay.net), 0)::float8 as collected,
      coalesce(sum(pay.refunded), 0)::float8 as refunded,
      coalesce(sum(pay.net) filter (where b.status = 'no_show'), 0)::float8 as kept,
      coalesce(sum(extract(epoch from b.ends_at - b.starts_at) / 60) filter (where b.status in ${ACTIVE}), 0)::float8 as booked_minutes
    from b
    left join pay on pay.booking_id = b.id
    left join firsts f on f.customer_id = b.customer_id`;
  const capacity = await capacityByArtist(f, range);
  return {
    revenuePaise: row.revenue,
    upcomingPaise: row.upcoming,
    unmarked: row.unmarked,
    bookings: row.bookings,
    completed: row.completed,
    noShows: row.no_shows,
    cancelled: row.cancelled,
    clients: row.clients,
    newClients: row.new_clients,
    collectedPaise: row.collected,
    refundedPaise: row.refunded,
    keptFromNoShowsPaise: row.kept,
    bookedMinutes: Math.round(row.booked_minutes),
    capacityMinutes: [...capacity.values()].reduce((s, m) => s + m, 0),
  };
}

/**
 * Shift minutes each active artist was available in the range: their weekly shifts on every day,
 * minus salon closures and the part of each shift covered by approved leave.
 */
async function capacityByArtist(f: ReportFilters, range: DateRange): Promise<Map<string, number>> {
  const rows = await sql<{ staff_id: string; minutes: number }[]>`
    with days as (
      select d::date as day from generate_series(${range.from}::date, ${range.to}::date, interval '1 day') d
      where d::date not in (select date from salon_closures)
    ),
    shifts as (
      select sh.staff_id,
        (days.day + sh.starts_at) at time zone 'Asia/Kolkata' as s_at,
        (days.day + sh.ends_at) at time zone 'Asia/Kolkata' as e_at
      from days
      join staff_shifts sh on sh.weekday = extract(dow from days.day)
      join staff st on st.id = sh.staff_id and st.active
      ${f.staffId ? sql`where sh.staff_id = ${f.staffId}` : sql``}
    )
    select staff_id, sum(
      extract(epoch from e_at - s_at) / 60 - coalesce((
        select sum(extract(epoch from least(l.ends_at, e_at) - greatest(l.starts_at, s_at)) / 60)
        from staff_leave l
        where l.staff_id = shifts.staff_id and l.status = 'approved' and l.starts_at < e_at and l.ends_at > s_at
      ), 0)
    )::float8 as minutes
    from shifts group by staff_id`;
  return new Map(rows.map((r) => [r.staff_id, Math.max(0, Math.round(r.minutes))]));
}

async function trendFor(f: ReportFilters, bucket: Bucket, now: Date, range: DateRange = f): Promise<TrendPoint[]> {
  const rows = await sql<{ key: string; revenue: number; upcoming: number; bookings: number }[]>`
    with b as (${scoped(f, range)})
    select to_char(date_trunc(${bucket}, b.starts_at at time zone 'Asia/Kolkata'), 'YYYY-MM-DD') as key,
      coalesce(sum(b.value) filter (where b.status = 'completed'), 0)::float8 as revenue,
      coalesce(sum(b.value) filter (where b.status = 'confirmed' and b.starts_at >= ${now}), 0)::float8 as upcoming,
      count(*) filter (where b.status in ${ACTIVE})::int as bookings
    from b group by 1`;
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return bucketKeys(range, bucket).map((key) => {
    const r = byKey.get(key);
    return { key, revenuePaise: r?.revenue ?? 0, upcomingPaise: r?.upcoming ?? 0, bookings: r?.bookings ?? 0 };
  });
}

async function channelsFor(f: ReportFilters): Promise<ChannelRow[]> {
  const rows = await sql<{ source: ReportSource; bookings: number; value: number; no_shows: number; completed: number }[]>`
    with b as (${scoped(f, f)})
    select source,
      count(*) filter (where status in ${ACTIVE})::int as bookings,
      coalesce(sum(value) filter (where status in ('confirmed', 'completed')), 0)::float8 as value,
      count(*) filter (where status = 'no_show')::int as no_shows,
      count(*) filter (where status = 'completed')::int as completed
    from b group by source`;
  return rows.map((r) => ({ source: r.source, bookings: r.bookings, valuePaise: r.value, noShows: r.no_shows, completed: r.completed }));
}

/** How far ahead online and phone clients book (walk-ins are same-day by definition). */
async function leadTimeFor(f: ReportFilters): Promise<LeadTimeRow[]> {
  const rows = await sql<{ bucket: LeadTimeBucket; bookings: number }[]>`
    with b as (${scoped(f, f)}),
    d as (
      select (starts_at at time zone 'Asia/Kolkata')::date - (created_at at time zone 'Asia/Kolkata')::date as days
      from b where status in ${ACTIVE} and source <> 'walk_in'
    )
    select case
        when days <= 0 then 'same_day' when days = 1 then '1_day' when days <= 3 then '2_3_days'
        when days <= 7 then '4_7_days' when days <= 14 then '8_14_days' else '15_plus'
      end as bucket, count(*)::int as bookings
    from d group by 1`;
  const byBucket = new Map(rows.map((r) => [r.bucket, r.bookings]));
  return LEAD_TIME_BUCKETS.map((bucket) => ({ bucket, bookings: byBucket.get(bucket) ?? 0 }));
}

/** Bookings by IST weekday (1 = Monday … 7 = Sunday) and starting hour. */
async function heatmapFor(f: ReportFilters): Promise<HeatCell[]> {
  return sql<HeatCell[]>`
    with b as (${scoped(f, f)})
    select extract(isodow from starts_at at time zone 'Asia/Kolkata')::int as weekday,
      extract(hour from starts_at at time zone 'Asia/Kolkata')::int as hour,
      count(*)::int as bookings
    from b where status in ${ACTIVE} group by 1, 2`;
}

async function servicesFor(f: ReportFilters): Promise<ServiceRow[]> {
  return sql<ServiceRow[]>`
    with b as (${scoped(f, f)})
    select s.id, s.name, c.name as category,
      count(*) filter (where b.status in ${ACTIVE})::int as bookings,
      coalesce(sum(i.price_snapshot_paise) filter (where b.status = 'completed'), 0)::float8 as "revenuePaise"
    from b
    join booking_items i on i.booking_id = b.id
    join services s on s.id = i.service_id
    join service_categories c on c.id = s.category_id
    ${f.categoryId ? sql`where s.category_id = ${f.categoryId}` : sql``}
    group by s.id, s.name, c.name
    having count(*) filter (where b.status in ${ACTIVE}) > 0
    order by "revenuePaise" desc, bookings desc, s.name`;
}

async function categoriesFor(f: ReportFilters): Promise<CategoryRow[]> {
  return sql<CategoryRow[]>`
    with b as (${scoped(f, f)})
    select c.id, c.name,
      count(distinct b.id) filter (where b.status in ${ACTIVE})::int as bookings,
      coalesce(sum(i.price_snapshot_paise) filter (where b.status = 'completed'), 0)::float8 as "revenuePaise"
    from b
    join booking_items i on i.booking_id = b.id
    join services s on s.id = i.service_id
    join service_categories c on c.id = s.category_id
    ${f.categoryId ? sql`where s.category_id = ${f.categoryId}` : sql``}
    group by c.id, c.name, c.sort_order
    having count(distinct b.id) filter (where b.status in ${ACTIVE}) > 0
    order by "revenuePaise" desc, c.sort_order`;
}

async function artistsFor(f: ReportFilters): Promise<ArtistRow[]> {
  const [rows, capacity] = await Promise.all([
    sql<{ id: string; name: string; photo_path: string | null; active: boolean; bookings: number; completed: number; no_shows: number; revenue: number; minutes: number; clients: number }[]>`
      with b as (${scoped(f, f)})
      select st.id, st.name, st.photo_path, st.active,
        count(b.id) filter (where b.status in ${ACTIVE})::int as bookings,
        count(b.id) filter (where b.status = 'completed')::int as completed,
        count(b.id) filter (where b.status = 'no_show')::int as no_shows,
        coalesce(sum(b.value) filter (where b.status = 'completed'), 0)::float8 as revenue,
        coalesce(sum(extract(epoch from b.ends_at - b.starts_at) / 60) filter (where b.status in ${ACTIVE}), 0)::float8 as minutes,
        count(distinct b.customer_id) filter (where b.status = 'completed')::int as clients
      from staff st
      left join b on b.staff_id = st.id
      ${f.staffId ? sql`where st.id = ${f.staffId}` : sql``}
      group by st.id, st.name, st.photo_path, st.active, st.sort_order
      order by revenue desc, st.sort_order`,
    capacityByArtist(f, f),
  ]);
  return rows
    // Former artists only appear for periods they worked in.
    .filter((r) => r.active || r.bookings > 0)
    .map((r) => ({
      id: r.id,
      name: r.name,
      photoPath: r.photo_path,
      bookings: r.bookings,
      completed: r.completed,
      noShows: r.no_shows,
      revenuePaise: r.revenue,
      bookedMinutes: Math.round(r.minutes),
      capacityMinutes: capacity.get(r.id) ?? 0,
      clients: r.clients,
    }));
}

async function topClientsFor(f: ReportFilters): Promise<ClientRow[]> {
  return sql<ClientRow[]>`
    with b as (${scoped(f, f)})
    select c.id, c.name, c.phone, count(*)::int as visits, sum(b.value)::float8 as "spentPaise", max(b.starts_at) as "lastVisit"
    from b join customers c on c.id = b.customer_id
    where b.status = 'completed'
    group by c.id
    order by "spentPaise" desc, visits desc
    limit 8`;
}

/**
 * Regulars drifting away: 2+ completed visits ever, none in the last WIN_BACK_DAYS and nothing
 * booked ahead. Independent of the period (it's about today); follows the artist filter.
 */
async function winBackFor(f: ReportFilters, now: Date): Promise<WinBackRow[]> {
  const cutoff = new Date(now.getTime() - WIN_BACK_DAYS * 86_400_000);
  return sql<WinBackRow[]>`
    select c.id, c.name, c.phone, count(*)::int as visits, sum(b.total_paise)::float8 as "spentPaise", max(b.starts_at) as "lastVisit",
      (select i.name_snapshot from booking_items i join bookings b2 on b2.id = i.booking_id
       where b2.customer_id = c.id and b2.status = 'completed'
       group by i.name_snapshot order by count(*) desc, i.name_snapshot limit 1) as favourite
    from bookings b join customers c on c.id = b.customer_id
    where b.status = 'completed' ${f.staffId ? sql`and b.staff_id = ${f.staffId}` : sql``}
    group by c.id
    having count(*) >= 2 and max(b.starts_at) < ${cutoff}
      and not exists (
        select 1 from bookings u where u.customer_id = c.id and u.status in ('pending', 'confirmed') and u.starts_at >= ${now}
      )
    order by "spentPaise" desc, "lastVisit" desc
    limit 10`;
}

export async function getReport(filters: ReportFilters, now: Date = new Date()): Promise<Report> {
  const bucket = pickBucket(filters);
  const ranges = comparisonRanges(filters, istToday(now));
  const sameAsShown = ranges && ranges.current.from === filters.from && ranges.current.to === filters.to;
  const [summary, comparedCurrent, comparedPrevious, trend, previousTrend, channels, leadTime, heatmap, services, categories, artists, topClients, winBack] =
    await Promise.all([
      summaryFor(filters, filters, now),
      ranges && !sameAsShown ? summaryFor(filters, ranges.current, now) : null,
      ranges ? summaryFor(filters, ranges.previous, now) : null,
      trendFor(filters, bucket, now),
      ranges ? trendFor(filters, bucket, now, previousRange(filters)) : null,
      channelsFor(filters),
      leadTimeFor(filters),
      heatmapFor(filters),
      servicesFor(filters),
      categoriesFor(filters),
      artistsFor(filters),
      topClientsFor(filters),
      winBackFor(filters, now),
    ]);
  const comparison =
    ranges && comparedPrevious
      ? { current: comparedCurrent ?? summary, previous: comparedPrevious, currentRange: ranges.current, previousRange: ranges.previous }
      : null;
  return { filters, bucket, summary, comparison, trend, previousTrend, channels, leadTime, heatmap, services, categories, artists, topClients, winBack };
}

/**
 * Artists and categories for the filter menus (inactive artists last, still selectable for
 * history), and the salon's opening hours as whole hours [first, last) for the heatmap's columns.
 */
export async function getReportOptions() {
  const [staff, categories, [hours]] = await Promise.all([
    sql<{ id: string; name: string; active: boolean }[]>`select id, name, active from staff order by active desc, sort_order, name`,
    sql<{ id: string; name: string }[]>`select id, name from service_categories order by sort_order, name`,
    sql<{ first: number | null; last: number | null }[]>`
      select min(extract(hour from opens_at))::int as first, max(ceil(extract(epoch from closes_at) / 3600))::int as last
      from opening_hours`,
  ]);
  const openHours: [number, number] = [hours?.first ?? 10, hours?.last ?? 20];
  return { staff, categories, openHours };
}
