-- FountLayer external-beta target data model.
-- Existing installations must use packages/db migrations rather than applying
-- this file directly. The migrator journals checksums and serializes execution.

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
  type text not null, -- direct, affiliate, plugin, marketplace, partner
  revenue_share_policy_id text,
  status text not null default 'active',
  created_at timestamptz default now(),
  unique(app_id, id)
);

create table end_users (
  id text primary key,
  app_id text not null references apps(id),
  external_user_hash text not null,
  region text,
  risk_score integer default 0,
  created_at timestamptz default now(),
  unique(app_id, external_user_hash),
  unique(app_id, id)
);

create table wallets (
  id text primary key,
  app_id text not null references apps(id),
  owner_type text not null, -- platform, developer, app, channel, end_user, provider_payable
  owner_id text not null,
  currency text not null default 'USD',
  balance_numeric numeric(18,8) not null default 0,
  created_at timestamptz default now(),
  unique(app_id, id)
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
  created_at timestamptz default now(),
  unique(app_id, id)
);

create table pricing_policies (
  id text primary key,
  app_id text not null references apps(id),
  name text not null,
  platform_fee_rate numeric(10,6) not null default 0.25,
  payment_fee_reserve_rate numeric(10,6) not null default 0.03,
  risk_reserve_rate numeric(10,6) not null default 0.05,
  developer_markup_rate numeric(10,6) not null default 0,
  channel_markup_rate numeric(10,6) not null default 0,
  max_total_markup_rate numeric(10,6) not null default 1.00,
  created_at timestamptz default now(),
  unique(app_id, id)
);

create table provider_credentials (
  id text primary key,
  app_id text not null references apps(id),
  owner_type text not null, -- platform, developer, end_user
  owner_id text not null,
  provider text not null,
  encrypted_api_key text not null,
  key_version text not null default 'local-v1',
  display text not null default 'configured',
  status text not null default 'active',
  budget_daily_numeric numeric(18,8),
  budget_monthly_numeric numeric(18,8),
  created_at timestamptz default now()
);

create table sessions (
  id text primary key,
  app_id text not null references apps(id),
  channel_id text not null,
  end_user_id text not null,
  use_case text not null,
  mode text not null, -- managed, developer_key, byok, local
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz default now(),
  foreign key (app_id, channel_id) references channels(app_id, id),
  foreign key (app_id, end_user_id) references end_users(app_id, id)
);

create table faucet_grants (
  id text primary key,
  sponsor_type text not null, -- platform, developer, provider, campaign
  sponsor_id text,
  app_id text not null references apps(id),
  channel_id text not null,
  end_user_id text not null,
  wallet_id text not null,
  amount_numeric numeric(18,8) not null,
  remaining_numeric numeric(18,8) not null,
  allowed_models jsonb not null,
  allowed_use_cases jsonb not null,
  daily_cap_numeric numeric(18,8) not null,
  expires_at timestamptz not null,
  status text not null default 'active',
  created_at timestamptz default now(),
  foreign key (app_id, channel_id) references channels(app_id, id),
  foreign key (app_id, end_user_id) references end_users(app_id, id),
  foreign key (app_id, wallet_id) references wallets(app_id, id)
);

create table usage_events (
  id text primary key,
  request_id text not null unique,
  app_id text not null references apps(id),
  channel_id text not null,
  end_user_id text not null,
  mode text not null, -- managed, developer_key, byok, local
  provider text,
  model text not null,
  route_id text,
  use_case text not null,
  input_tokens integer default 0,
  output_tokens integer default 0,
  cached_input_tokens integer default 0,
  usage_estimated boolean default false,
  upstream_cost_numeric numeric(18,8) default 0,
  wholesale_price_numeric numeric(18,8) default 0,
  retail_price_numeric numeric(18,8) default 0,
  faucet_grant_id text references faucet_grants(id),
  status text not null, -- success, failed, refunded
  created_at timestamptz default now(),
  unique(app_id, id),
  foreign key (app_id, channel_id) references channels(app_id, id),
  foreign key (app_id, end_user_id) references end_users(app_id, id),
  foreign key (app_id, route_id) references routes(app_id, id)
);

create table ledger_entries (
  id text primary key,
  app_id text not null references apps(id),
  usage_event_id text,
  wallet_id text,
  direction text not null, -- debit, credit
  amount_numeric numeric(18,8) not null,
  reason text not null,
  metadata jsonb,
  created_at timestamptz default now(),
  foreign key (app_id, usage_event_id) references usage_events(app_id, id),
  foreign key (app_id, wallet_id) references wallets(app_id, id)
);

create table session_ticket_redemptions (
  ticket_id_hash text primary key,
  app_id text not null references apps(id),
  expires_at timestamptz not null,
  redeemed_at timestamptz not null default now()
);

create table rate_limit_counters (
  key_hash text primary key,
  scope text not null,
  count integer not null check (count >= 0),
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table idempotency_records (
  session_id text not null references sessions(id) on delete cascade,
  idempotency_key text not null,
  request_hash text not null,
  reservation_id text not null,
  status text not null default 'processing', -- processing, completed
  locked_until timestamptz not null,
  usage_event_id text references usage_events(id),
  created_at timestamptz default now(),
  completed_at timestamptz,
  primary key(session_id, idempotency_key)
);

-- This table is owned by packages/db/src/migrate.ts. It is included here so
-- operators can see the complete runtime schema, but migrations create it
-- before applying numbered SQL files.
create table fountlayer_schema_migrations (
  version text primary key,
  checksum text not null,
  applied_at timestamptz not null default now()
);

alter table apps
  add foreign key (id, default_route_id) references routes(app_id, id)
  deferrable initially deferred;
alter table apps
  add foreign key (id, default_pricing_policy_id)
  references pricing_policies(app_id, id)
  deferrable initially deferred;

create or replace function validate_provider_credential_scope()
returns trigger
language plpgsql
as $$
begin
  if new.owner_type = 'end_user' then
    if not exists (
      select 1 from end_users
      where app_id = new.app_id and id = new.owner_id
    ) then
      raise foreign_key_violation using
        message = 'Provider credential end user does not belong to app.';
    end if;
  elsif new.owner_type = 'developer' then
    if not exists (
      select 1 from apps
      where id = new.app_id and developer_id = new.owner_id
    ) then
      raise foreign_key_violation using
        message = 'Provider credential developer does not own app.';
    end if;
  elsif new.owner_type = 'app' then
    if new.owner_id <> new.app_id then
      raise foreign_key_violation using
        message = 'Provider credential app owner does not match app scope.';
    end if;
  elsif new.owner_type <> 'platform' then
    raise check_violation using
      message = 'Unsupported provider credential owner type.';
  end if;

  return new;
end
$$;

create trigger provider_credentials_validate_scope
before insert or update of app_id, owner_type, owner_id
on provider_credentials
for each row execute function validate_provider_credential_scope();

create index idx_usage_events_app_created on usage_events(app_id, created_at);
create index idx_usage_events_channel_created on usage_events(channel_id, created_at);
create index idx_usage_events_user_created on usage_events(end_user_id, created_at);
create index idx_ledger_entries_usage_event on ledger_entries(usage_event_id);
create index idx_ledger_entries_app_created on ledger_entries(app_id, created_at);
create index idx_faucet_grants_scope on faucet_grants(app_id, channel_id, end_user_id, status);
create index idx_sessions_token_hash on sessions(token_hash);
create index idx_sessions_attribution on sessions(app_id, channel_id, end_user_id);
create index idx_idempotency_records_usage_event on idempotency_records(usage_event_id);
create index idx_session_ticket_redemptions_expires on session_ticket_redemptions(expires_at);
create index idx_rate_limit_counters_reset on rate_limit_counters(reset_at);
create index idx_wallets_app_owner on wallets(app_id, owner_type, owner_id);
create index idx_provider_credentials_app_owner on provider_credentials(app_id, owner_type, owner_id);
