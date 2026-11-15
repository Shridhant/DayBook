-- migrate:up

-- Better Auth tables (generated with `npm run auth:schema`, then tightened by hand).
-- Customers never log in; these are for the owner, receptionists and technicians only.

create table users (
  id uuid default gen_random_uuid() not null primary key,
  name text not null,
  email text not null unique,
  email_verified boolean not null default false,
  image text,
  -- AGENTS.md §8 roles. Better Auth sees this as a plain string; the database enforces the values.
  role text not null default 'staff' check (role in ('owner', 'receptionist', 'staff')),
  -- Link to the technician profile for role = 'staff' (phase 2 staff portal). One login per technician.
  staff_id uuid unique references staff (id) on delete set null,
  -- Deactivating a user blocks sign-in; their sessions are deleted at the same time.
  active boolean not null default true,
  created_at timestamptz default current_timestamp not null,
  updated_at timestamptz default current_timestamp not null
);

create table sessions (
  id uuid default gen_random_uuid() not null primary key,
  expires_at timestamptz not null,
  token text not null unique,
  created_at timestamptz default current_timestamp not null,
  updated_at timestamptz not null,
  ip_address text,
  user_agent text,
  user_id uuid not null references users (id) on delete cascade
);
create index sessions_user_id_idx on sessions (user_id);

create table accounts (
  id uuid default gen_random_uuid() not null primary key,
  account_id text not null,
  provider_id text not null,
  user_id uuid not null references users (id) on delete cascade,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  -- Password hash (scrypt) for email/password accounts. Never the password itself.
  password text,
  created_at timestamptz default current_timestamp not null,
  updated_at timestamptz not null
);
create index accounts_user_id_idx on accounts (user_id);

create table verifications (
  id uuid default gen_random_uuid() not null primary key,
  identifier text not null,
  value text not null,
  expires_at timestamptz not null,
  created_at timestamptz default current_timestamp not null,
  updated_at timestamptz default current_timestamp not null
);
create index verifications_identifier_idx on verifications (identifier);

-- Login rate limiting counters (kept in Postgres so limits survive restarts).
create table rate_limits (
  id uuid default gen_random_uuid() not null primary key,
  key text not null unique,
  count integer not null,
  last_request bigint not null
);

-- migrate:down
drop table rate_limits;
drop table verifications;
drop table accounts;
drop table sessions;
drop table users;
