-- One-time setup for a Supabase database (run in Supabase → SQL Editor). Safe to re-run: run it
-- before the migrations (for uuidv7) and again after them (so daybook_app can use the new tables).
-- Supabase's `postgres` role owns the schema and runs migrations (dbmate). The app connects as
-- `daybook_app`, which can only read and write rows, never change the schema (AGENTS.md §6).
--
-- 1. Replace CHANGE_ME with a strong password (openssl rand -base64 24) before running.
--    Don't save the password in this file.
-- 2. Also turn off Supabase's Data API for the public schema (Project Settings → Data API),
--    or anyone with the project's public key could read the tables. Daybook doesn't use it.

-- uuidv7() for Postgres < 18 ---------------------------------------------------
-- Every table's id defaults to uuidv7(), built into Postgres 18. On older servers this adds an
-- equivalent (time-ordered UUID v7) so the migrations run unchanged. No-op on Postgres 18+.
do $$
begin
  if current_setting('server_version_num')::int < 180000
     and not exists (select from pg_proc where proname = 'uuidv7' and pronamespace = 'public'::regnamespace) then
    execute $f$
      create function public.uuidv7() returns uuid language sql volatile as $body$
        -- 48-bit Unix ms timestamp, then random bits; version nibble set to 7 (bits 52 and 53).
        select encode(
          set_bit(set_bit(
            overlay(uuid_send(gen_random_uuid())
                    placing substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3)
                    from 1 for 6),
            52, 1), 53, 1),
          'hex')::uuid
      $body$
    $f$;
  end if;
end $$;

-- App role ---------------------------------------------------------------------
do $$
begin
  if not exists (select from pg_roles where rolname = 'daybook_app') then
    create role daybook_app login password 'CHANGE_ME';
  end if;
end $$;

grant usage on schema public to daybook_app;
-- Tables, sequences and functions the migrations create later (as `postgres`):
alter default privileges for role postgres in schema public grant select, insert, update, delete on tables to daybook_app;
alter default privileges for role postgres in schema public grant usage, select on sequences to daybook_app;
alter default privileges for role postgres in schema public grant execute on functions to daybook_app;
-- And anything that already exists (safe to re-run after migrations):
grant select, insert, update, delete on all tables in schema public to daybook_app;
grant usage, select on all sequences in schema public to daybook_app;
grant execute on all functions in schema public to daybook_app;

