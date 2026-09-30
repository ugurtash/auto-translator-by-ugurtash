-- Auto-Translator production schema.
-- Apply this to the dedicated Supabase project before enabling production traffic.

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  role text not null default 'user' check (role in ('user','owner')),
  created_at timestamptz not null default now()
);

create table if not exists public.entitlements (
  user_id uuid primary key references public.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','premium','owner')),
  status text not null default 'inactive' check (status in ('inactive','active','cancelled','expired')),
  provider_customer_id text,
  provider_subscription_id text unique,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_usage (
  user_id uuid not null references public.users(id) on delete cascade,
  usage_date date not null,
  words integer not null default 0 check (words >= 0),
  primary key (user_id, usage_date)
);

create index if not exists entitlements_provider_customer_idx
  on public.entitlements(provider_customer_id);

create index if not exists daily_usage_date_idx
  on public.daily_usage(usage_date);
