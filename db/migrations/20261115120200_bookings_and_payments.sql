-- migrate:up

-- Customers never log in; the normalised 10-digit Indian mobile number is their identity.
create table customers (
  id uuid primary key default uuidv7(),
  name text not null,
  phone text not null unique check (phone ~ '^[6-9][0-9]{9}$'),
  email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger customers_updated_at before update on customers for each row execute function set_updated_at();

create table bookings (
  id uuid primary key default uuidv7(),
  -- Short human reference shown to customers, e.g. DB-7K2Q.
  code text not null unique check (code ~ '^DB-[0-9A-Z]{4,8}$'),
  customer_id uuid not null references customers (id) on delete restrict,
  staff_id uuid not null references staff (id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null check (status in ('pending', 'confirmed', 'completed', 'no_show', 'cancelled', 'expired')),
  source text not null check (source in ('online', 'walk_in', 'phone')),
  total_paise integer not null check (total_paise >= 0),
  amount_due_now_paise integer not null default 0 check (amount_due_now_paise >= 0),
  hold_expires_at timestamptz,
  notes text,
  cancelled_at timestamptz,
  cancel_reason text,
  -- Better Auth user id of the admin/receptionist who created it (null for online bookings).
  created_by_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (amount_due_now_paise <= total_paise),
  check (status <> 'pending' or hold_expires_at is not null),
  check (status <> 'cancelled' or cancelled_at is not null),

  -- The double-booking guard (AGENTS.md §7). Two active bookings for the same technician can never
  -- overlap. '[)' means a booking ending at 4:00 and one starting at 4:00 do not clash.
  -- Expired holds are flipped to 'expired' before inserting a new hold, so they stop blocking.
  constraint bookings_no_overlap exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending', 'confirmed', 'completed'))
);
create index bookings_staff_time_idx on bookings (staff_id, starts_at);
create index bookings_starts_at_idx on bookings (starts_at);
create index bookings_customer_idx on bookings (customer_id, starts_at desc);
create index bookings_pending_holds_idx on bookings (hold_expires_at) where status = 'pending';
create trigger bookings_updated_at before update on bookings for each row execute function set_updated_at();

-- Services on a booking, with name/price/duration copied at booking time so later edits never change it.
create table booking_items (
  id uuid primary key default uuidv7(),
  booking_id uuid not null references bookings (id) on delete cascade,
  service_id uuid not null references services (id) on delete restrict,
  name_snapshot text not null,
  price_snapshot_paise integer not null check (price_snapshot_paise >= 0),
  duration_snapshot_min smallint not null check (duration_snapshot_min > 0),
  position smallint not null default 0
);
create index booking_items_booking_idx on booking_items (booking_id, position);

create table payments (
  id uuid primary key default uuidv7(),
  booking_id uuid not null references bookings (id) on delete restrict,
  provider text not null default 'razorpay' check (provider in ('razorpay')),
  rzp_order_id text not null unique,
  rzp_payment_id text unique,
  amount_paise integer not null check (amount_paise > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'created'
    check (status in ('created', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded')),
  refunded_paise integer not null default 0 check (refunded_paise >= 0),
  rzp_refund_id text,
  -- Set when money arrived but the booking couldn't be confirmed (e.g. hold expired and slot taken).
  needs_review boolean not null default false,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (refunded_paise <= amount_paise)
);
create index payments_booking_idx on payments (booking_id);
create index payments_needs_review_idx on payments (created_at) where needs_review;
create trigger payments_updated_at before update on payments for each row execute function set_updated_at();

-- Every Razorpay webhook delivery, keyed by its event id, so retries are processed exactly once.
create table payment_events (
  id uuid primary key default uuidv7(),
  rzp_event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

-- migrate:down
drop table payment_events;
drop table payments;
drop table booking_items;
drop table bookings;
drop table customers;
