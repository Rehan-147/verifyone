-- VerifyOne Supabase Schema
create extension if not exists "uuid-ossp";
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  auth_id uuid unique references auth.users(id) on delete cascade,
  email text unique not null,
  name text,
  plan text default 'starter',
  credits int default 1000,
  auto_replenish boolean default false,
  stripe_customer_id text,
  created_at timestamptz default now()
);
create table if not exists api_keys (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  key_hash text not null,
  prefix text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);
create table if not exists check_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id),
  type text not null,
  input text not null,
  result jsonb not null,
  credits_used int not null,
  cached boolean default false,
  created_at timestamptz default now()
);
create table if not exists bulk_jobs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id),
  batch_id text unique not null,
  total_rows int default 0,
  processed_rows int default 0,
  status text default 'accepted',
  created_at timestamptz default now()
);
create table if not exists integrations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  provider text not null,
  config jsonb default '{}'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now()
);
create table if not exists webhooks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  url text not null,
  events text[] default array['validation.completed'],
  secret text not null,
  created_at timestamptz default now()
);
create table if not exists cache_results (
  id uuid primary key default uuid_generate_v4(),
  input_hash text unique not null,
  type text not null,
  result jsonb not null,
  expires_at timestamptz default (now() + interval '7 days')
);
alter table users enable row level security;
alter table api_keys enable row level security;
create policy "users own" on users for all using (auth.uid() = auth_id);
