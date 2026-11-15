-- One-time local setup: roles + databases. Run as a Postgres superuser via scripts/db-setup-local.sh.
-- Idempotent: safe to run again (it also resets the role passwords to the ones in .env.local).
-- Expects psql variables: owner_pw, app_pw.
\set ON_ERROR_STOP on

-- Roles -----------------------------------------------------------------------
select format('create role daybook_owner login password %L', :'owner_pw')
where not exists (select from pg_roles where rolname = 'daybook_owner') \gexec
select format('alter role daybook_owner password %L', :'owner_pw') \gexec

select format('create role daybook_app login password %L', :'app_pw')
where not exists (select from pg_roles where rolname = 'daybook_app') \gexec
select format('alter role daybook_app password %L', :'app_pw') \gexec

-- Databases (owned by daybook_owner, so it owns the public schema) -------------
select 'create database daybook owner daybook_owner'
where not exists (select from pg_database where datname = 'daybook') \gexec
select 'create database daybook_test owner daybook_owner'
where not exists (select from pg_database where datname = 'daybook_test') \gexec

revoke all on database daybook, daybook_test from public;
grant connect on database daybook, daybook_test to daybook_app;

-- Privileges inside each database ----------------------------------------------
-- The app role can read/write rows in tables the owner creates, but never change the schema.
\connect daybook
revoke create on schema public from public;
grant usage on schema public to daybook_app;
alter default privileges for role daybook_owner in schema public grant select, insert, update, delete on tables to daybook_app;
alter default privileges for role daybook_owner in schema public grant usage, select on sequences to daybook_app;
alter default privileges for role daybook_owner in schema public grant execute on functions to daybook_app;

\connect daybook_test
revoke create on schema public from public;
grant usage on schema public to daybook_app;
alter default privileges for role daybook_owner in schema public grant select, insert, update, delete on tables to daybook_app;
alter default privileges for role daybook_owner in schema public grant usage, select on sequences to daybook_app;
alter default privileges for role daybook_owner in schema public grant execute on functions to daybook_app;
