create table if not exists products (
  id text primary key,
  shopify_id text,
  title text not null,
  price_cents int not null,
  cost_cents int not null,
  stock int not null,
  units_sold_30d int not null default 0,
  image_url text,
  product_url text,
  updated_at timestamptz not null default now()
);

create table if not exists policies (
  id int primary key default 1,
  min_margin_pct int not null,
  max_daily_spend_cents int not null,
  min_stock int not null
);

create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  payload jsonb not null
);

create table if not exists counters (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  proposed_price_cents int not null,
  margin_pct int not null,
  stock int not null,
  doable boolean not null,
  reason text not null
);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  platform text not null,
  status text not null,
  external_id text,
  payload jsonb not null
);

create table if not exists research (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  query text not null,
  payload jsonb not null
);

insert into policies (id, min_margin_pct, max_daily_spend_cents, min_stock)
values (1, 40, 15000, 5)
on conflict (id) do nothing;

grant select, insert, update, delete on products, policies, decisions, counters, campaigns, research
  to anon, authenticated, service_role;
