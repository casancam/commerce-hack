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
