-- migrate:up

-- Fixed-window rate limits for public endpoints (spam protection). One row per key, e.g.
-- "hold:ip:203.0.113.5". Old rows are pruned by the cron endpoint.
create table request_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 0
);
create index request_limits_window_idx on request_limits (window_start);

-- migrate:down
drop table request_limits;
