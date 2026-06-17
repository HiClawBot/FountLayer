-- FountLayer MVP Data Model

create table developers (
  id text primary key,
  name text not null,
  email text unique,
  created_at timestamptz default now()
);

create table apps (
  id text primary key,
  developer_id text not null references developers(id),
  name text not null,
  default_route_id text,
  default_pricing_policy_id text,
  allow_managed boolean default true,
  allow_byok boolean default true,
  allow_local boolean default true,
  status text not null default 'active',
  created_at timestamptz default now()
);

create table channels (
  id text primary key,
  app_id text not null references apps(id),
  name text not null,
  type text not null,
  revenue_share_policy_id text,
  status text not null default 'active',
  created_at timestamptz default now()
);

create table end_users (
  id text primary key,
  app_id text not null references apps(id),
  external_user_hash text not null,
  region text,
  risk_score integer default 0,
  created_at timestamptz default now(),
  unique(app_id, external_user_hash)
);

create table wallets (
  id text primary key,
  owner_type text not null,
  owner_id text not null,
  currency text not null default 'USD',
  balance_numeric numeric(18,8) not null default 0,
  created_at timestamptz default now()
);

create table model_prices (
  id text primary key,
  provider text not null,
  model text not null,
  input_per_mtok numeric(18,8) not null,
  output_per_mtok numeric(18,8) not null,
  cached_input_per_mtok numeric(18,8),
  currency text not null default 'USD',
  source text,
  effective_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(provider, model, effective_at)
);

create table routes (
  id text primary key,
  app_id text not null references apps(id),
  alias text not null,
  config jsonb not null,
  status text not null default 'active',
  created_at timestamptz default now()
);

create table pricing_policies (
  id text primary key,
  app_id text references apps(id),
  name text not null,
  platform_fee_rate numeric(10,6) not null default 0.25,
  payment_fee_reserve_rate numeric(10,6) not null default 0.03,
  risk_reserve_rate numeric(10,6) not null default 0.05,
  developer_markup_rate numeric(10,6) not null default 0,
  channel_markup_rate numeric(10,6) not null default 0,
  max_total_markup_rate numeric(10,6) not null default 1.00,
  created_at timestamptz default now()
);

create table provider_credentials (
  id text primary key,
  owner_type text not null,
  owner_id text not null,
  provider text not null,
  encrypted_api_key text not null,
  status text not null default 'active',
  budget_daily_numeric numeric(18,8),
  budget_monthly_numeric numeric(18,8),
  created_at timestamptz default now()
);

create table sessions (
  id text primary key,
  app_id text not null references apps(id),
  channel_id text not null references channels(id),
  end_user_id text not null references end_users(id),
  use_case text not null,
  mode text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz default now()
);

create table faucet_grants (
  id text primary key,
  sponsor_type text not null,
  sponsor_id text,
  app_id text not null references apps(id),
  channel_id text not null references channels(id),
  end_user_id text not null references end_users(id),
  wallet_id text not null references wallets(id),
  amount_numeric numeric(18,8) not null,
  remaining_numeric numeric(18,8) not null,
  allowed_models jsonb not null,
  allowed_use_cases jsonb not null,
  daily_cap_numeric numeric(18,8) not null,
  expires_at timestamptz not null,
  status text not null default 'active',
  created_at timestamptz default now()
);

create table usage_events (
  id text primary key,
  request_id text not null unique,
  app_id text not null references apps(id),
  channel_id text not null references channels(id),
  end_user_id text not null references end_users(id),
  mode text not null,
  provider text,
  model text not null,
  route_id text references routes(id),
  use_case text not null,
  input_tokens integer default 0,
  output_tokens integer default 0,
  cached_input_tokens integer default 0,
  usage_estimated boolean default false,
  upstream_cost_numeric numeric(18,8) default 0,
  wholesale_price_numeric numeric(18,8) default 0,
  retail_price_numeric numeric(18,8) default 0,
  faucet_grant_id text references faucet_grants(id),
  status text not null,
  created_at timestamptz default now()
);

create table ledger_entries (
  id text primary key,
  usage_event_id text references usage_events(id),
  wallet_id text references wallets(id),
  direction text not null,
  amount_numeric numeric(18,8) not null,
  reason text not null,
  metadata jsonb,
  created_at timestamptz default now()
);

create index idx_usage_events_app_created on usage_events(app_id, created_at);
create index idx_usage_events_channel_created on usage_events(channel_id, created_at);
create index idx_usage_events_user_created on usage_events(end_user_id, created_at);
create index idx_ledger_entries_usage_event on ledger_entries(usage_event_id);
create index idx_faucet_grants_scope on faucet_grants(app_id, channel_id, end_user_id, status);
create index idx_sessions_token_hash on sessions(token_hash);
create index idx_sessions_attribution on sessions(app_id, channel_id, end_user_id);
