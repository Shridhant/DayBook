-- migrate:up

-- In-app notifications for the admin (owner + front desk). Read state is per person.
create table notifications (
  id uuid primary key default uuidv7(),
  type text not null check (type in ('booking_confirmed', 'payment_review', 'booking_cancelled')),
  title text not null,
  body text,
  booking_id uuid references bookings (id) on delete set null,
  -- Same event never notifies twice (webhook retries, verify + webhook racing).
  dedupe_key text not null unique,
  created_at timestamptz not null default now()
);
create index notifications_recent_idx on notifications (created_at desc);

create table notification_reads (
  user_id uuid not null references users (id) on delete cascade,
  notification_id uuid not null references notifications (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, notification_id)
);

-- Outgoing email queue. Rows are written in the same transaction as the event, then sent by
-- server/email.ts (right after the response, and retried by the cron endpoint).
create table email_outbox (
  id uuid primary key default uuidv7(),
  dedupe_key text not null unique,
  to_email text not null,
  subject text not null,
  html text not null,
  text_body text not null,
  -- Optional .ics calendar attachment.
  ics text,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'expired')),
  attempts smallint not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_outbox_due_idx on email_outbox (next_attempt_at) where status in ('pending', 'sending');

-- migrate:down
drop table email_outbox;
drop table notification_reads;
drop table notifications;
