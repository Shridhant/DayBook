-- migrate:up

-- btree_gist lets an exclusion constraint combine "same staff" (=) with "overlapping time" (&&).
-- It is a trusted extension, so the database owner can create it.
create extension if not exists btree_gist;

-- Keeps updated_at current on every UPDATE.
create function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Salon-wide settings. Exactly one row (id is always true).
create table settings (
  id boolean primary key default true check (id),
  salon_name text not null default 'Daybook',
  -- Booking amount rule (AGENTS.md §7): a fixed amount or a percentage of the total.
  booking_amount_type text not null default 'fixed' check (booking_amount_type in ('fixed', 'percent')),
  booking_amount_fixed_paise integer not null default 50000 check (booking_amount_fixed_paise >= 0),
  booking_amount_percent smallint not null default 20 check (booking_amount_percent between 0 and 100),
  cancel_window_hours smallint not null default 24 check (cancel_window_hours between 0 and 168),
  slot_interval_min smallint not null default 15 check (slot_interval_min in (5, 10, 15, 20, 30, 60)),
  booking_window_days smallint not null default 30 check (booking_window_days between 1 and 180),
  lead_time_min smallint not null default 60 check (lead_time_min between 0 and 1440),
  hold_minutes smallint not null default 15 check (hold_minutes between 5 and 60),
  show_customer_phone_to_staff boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger settings_updated_at before update on settings for each row execute function set_updated_at();
insert into settings default values;

-- Public opening hours (shown on the site; also bounds staff shifts). No row = closed that weekday.
-- Times are wall-clock in Asia/Kolkata.
create table opening_hours (
  weekday smallint primary key check (weekday between 0 and 6), -- 0 = Sunday
  opens_at time not null,
  closes_at time not null,
  check (closes_at > opens_at)
);

-- Whole-day closures (holidays, renovations).
create table salon_closures (
  id uuid primary key default uuidv7(),
  date date not null unique,
  reason text,
  created_at timestamptz not null default now()
);

-- migrate:down
drop table salon_closures;
drop table opening_hours;
drop table settings;
drop function set_updated_at();
drop extension if exists btree_gist;
