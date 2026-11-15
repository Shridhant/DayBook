-- migrate:up

-- Phase 2 staff portal: technicians request leave, the front desk approves or declines it.
alter table staff_leave
  add column requested_by uuid references users (id) on delete set null,
  add column decided_by uuid references users (id) on delete set null,
  add column decided_at timestamptz,
  -- Shown to the technician when a request is declined.
  add column decision_note text;
create index staff_leave_requested_idx on staff_leave (created_at) where status = 'requested';

-- Leave requests notify the front desk in the admin bell. They aren't tied to a booking.
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('booking_confirmed', 'payment_review', 'booking_cancelled', 'leave_requested'));
alter table notifications add column staff_leave_id uuid references staff_leave (id) on delete cascade;

-- migrate:down

delete from notifications where type = 'leave_requested';
alter table notifications drop column staff_leave_id;
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('booking_confirmed', 'payment_review', 'booking_cancelled'));
drop index staff_leave_requested_idx;
alter table staff_leave
  drop column decision_note,
  drop column decided_at,
  drop column decided_by,
  drop column requested_by;
