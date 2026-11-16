-- One-time setup for a Supabase database, before the migrations (Supabase → SQL Editor, or psql).
-- Every table's id defaults to uuidv7(), built into Postgres 18. Supabase runs an older version,
-- so this adds an equivalent (time-ordered UUID v7). It does nothing on Postgres 18+.
-- Also turn off Supabase's Data API (Project Settings → Data API): Daybook talks to Postgres
-- directly, and leaving the API on would let anyone with the project's public key read the tables.
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
