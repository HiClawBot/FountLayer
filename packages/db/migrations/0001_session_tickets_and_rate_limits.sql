-- Durable public bootstrap and abuse controls for v0.5.0-beta.2.

create table if not exists session_ticket_redemptions (
  ticket_id_hash text primary key,
  app_id text not null references apps(id),
  expires_at timestamptz not null,
  redeemed_at timestamptz not null default now()
);

create index if not exists idx_session_ticket_redemptions_expires
  on session_ticket_redemptions(expires_at);

create table if not exists rate_limit_counters (
  key_hash text primary key,
  scope text not null,
  count integer not null check (count >= 0),
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_rate_limit_counters_reset
  on rate_limit_counters(reset_at);
