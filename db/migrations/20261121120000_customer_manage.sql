-- migrate:up

-- Customers can move their own booking (phase 2 "manage booking" link), a limited number of times.
alter table bookings add column reschedule_count smallint not null default 0 check (reschedule_count >= 0);

-- The front desk hears about customer changes in the admin bell.
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('booking_confirmed', 'payment_review', 'booking_cancelled', 'leave_requested', 'refund_failed', 'booking_rescheduled'));

-- migrate:down

delete from notifications where type = 'booking_rescheduled';
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('booking_confirmed', 'payment_review', 'booking_cancelled', 'leave_requested', 'refund_failed'));
alter table bookings drop column reschedule_count;
