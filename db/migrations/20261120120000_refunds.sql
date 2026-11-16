-- migrate:up

-- Refunds of online payments (phase 2). A row is written *before* Razorpay is called, so a
-- network failure can't lose track of a refund and a double click can't refund twice.
-- payments.refunded_paise is the sum of a payment's refunds that haven't failed; payments.status
-- stays 'captured' (the money was taken), so "paid net of refunds" is amount_paise - refunded_paise.
create table refunds (
  id uuid primary key default uuidv7(),
  payment_id uuid not null references payments (id) on delete restrict,
  booking_id uuid not null references bookings (id) on delete restrict,
  amount_paise integer not null check (amount_paise > 0),
  -- creating: saved, Razorpay not answered yet · pending: accepted by Razorpay, on its way to the
  -- customer · processed: done · failed: Razorpay couldn't refund (money still with the salon).
  status text not null default 'creating' check (status in ('creating', 'pending', 'processed', 'failed')),
  rzp_refund_id text unique,
  reason text,
  -- The team member who refunded; null for automatic refunds and ones made in the Razorpay dashboard.
  created_by uuid references users (id) on delete set null,
  source text not null default 'admin' check (source in ('admin', 'auto', 'dashboard')),
  failure_reason text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index refunds_booking_idx on refunds (booking_id, created_at);
create index refunds_open_idx on refunds (created_at) where status in ('creating', 'pending');
create trigger refunds_updated_at before update on refunds for each row execute function set_updated_at();

-- Replaced by the refunds table (a payment can be refunded in several parts).
alter table payments drop column rzp_refund_id;

-- Owner alert when Razorpay rejects or fails a refund.
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('booking_confirmed', 'payment_review', 'booking_cancelled', 'leave_requested', 'refund_failed'));

-- migrate:down

delete from notifications where type = 'refund_failed';
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('booking_confirmed', 'payment_review', 'booking_cancelled', 'leave_requested'));
alter table payments add column rzp_refund_id text;
drop table refunds;
