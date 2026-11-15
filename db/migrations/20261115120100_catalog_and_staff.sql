-- migrate:up

create table service_categories (
  id uuid primary key default uuidv7(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger service_categories_updated_at before update on service_categories for each row execute function set_updated_at();

create table services (
  id uuid primary key default uuidv7(),
  category_id uuid not null references service_categories (id) on delete restrict,
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  price_paise integer not null check (price_paise >= 0),
  -- "from ₹800" style pricing for services whose final price depends on the design.
  price_is_from boolean not null default false,
  duration_min smallint not null check (duration_min > 0 and duration_min % 5 = 0),
  -- Overrides the settings booking amount for this service (e.g. extensions need more).
  booking_amount_override_paise integer check (booking_amount_override_paise >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index services_category_idx on services (category_id, sort_order);
create trigger services_updated_at before update on services for each row execute function set_updated_at();

create table staff (
  id uuid primary key default uuidv7(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  photo_path text,
  bio text,
  specialties text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger staff_updated_at before update on staff for each row execute function set_updated_at();

-- Which technician can do which service. price_override_paise stays NULL until seniority pricing (phase 3).
create table staff_services (
  staff_id uuid not null references staff (id) on delete cascade,
  service_id uuid not null references services (id) on delete cascade,
  price_override_paise integer check (price_override_paise >= 0),
  primary key (staff_id, service_id)
);
create index staff_services_service_idx on staff_services (service_id);

-- Weekly recurring shifts, wall-clock time in Asia/Kolkata. Split shifts = several rows per weekday.
create table staff_shifts (
  id uuid primary key default uuidv7(),
  staff_id uuid not null references staff (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  starts_at time not null,
  ends_at time not null,
  check (ends_at > starts_at),
  unique (staff_id, weekday, starts_at)
);

-- Leave / time off. Owner-created leave is approved immediately; staff requests (phase 2) start as requested.
create table staff_leave (
  id uuid primary key default uuidv7(),
  staff_id uuid not null references staff (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  status text not null default 'approved' check (status in ('requested', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index staff_leave_lookup_idx on staff_leave (staff_id, starts_at) where status = 'approved';
create trigger staff_leave_updated_at before update on staff_leave for each row execute function set_updated_at();

-- migrate:down
drop table staff_leave;
drop table staff_shifts;
drop table staff_services;
drop table staff;
drop table services;
drop table service_categories;
