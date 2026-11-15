-- migrate:up

create table portfolio_items (
  id uuid primary key default uuidv7(),
  image_path text not null,
  -- Intrinsic size, so next/image can reserve space and avoid layout shift.
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  alt text not null,
  caption text,
  category_id uuid references service_categories (id) on delete set null,
  featured boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index portfolio_items_listing_idx on portfolio_items (sort_order) where active;
create trigger portfolio_items_updated_at before update on portfolio_items for each row execute function set_updated_at();

create table instagram_posts (
  id uuid primary key default uuidv7(),
  url text not null unique check (url ~ '^https://www\.instagram\.com/(p|reel)/[A-Za-z0-9_-]+/?$'),
  kind text not null check (kind in ('reel', 'post')),
  thumbnail_path text,
  caption text,
  placement text not null default 'portfolio' check (placement in ('hero', 'portfolio', 'reviews')),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger instagram_posts_updated_at before update on instagram_posts for each row execute function set_updated_at();

create table testimonials (
  id uuid primary key default uuidv7(),
  name text not null,
  quote text not null,
  rating smallint not null default 5 check (rating between 1 and 5),
  service_label text,
  media_url text,
  visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger testimonials_updated_at before update on testimonials for each row execute function set_updated_at();

-- migrate:down
drop table testimonials;
drop table instagram_posts;
drop table portfolio_items;
