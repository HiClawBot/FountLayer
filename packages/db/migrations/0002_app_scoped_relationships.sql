-- Make tenant ownership explicit and reject cross-app relational drift.

alter table wallets add column if not exists app_id text;
alter table provider_credentials add column if not exists app_id text;
alter table ledger_entries add column if not exists app_id text;

do $$
begin
  if exists (
    select wallet_id
    from (
      select wallet_id, app_id from faucet_grants
      union all
      select le.wallet_id, ue.app_id
      from ledger_entries le
      join usage_events ue on ue.id = le.usage_event_id
      where le.wallet_id is not null
      union all
      select w.id, eu.app_id
      from wallets w
      join end_users eu
        on w.owner_type = 'end_user'
       and eu.id = w.owner_id
    ) candidates(wallet_id, app_id)
    group by wallet_id
    having count(distinct app_id) > 1
  ) then
    raise exception 'A wallet is linked to more than one app; split it before migration.';
  end if;
end
$$;

with wallet_apps as (
  select wallet_id, min(app_id) as app_id
  from (
    select wallet_id, app_id from faucet_grants
    union all
    select le.wallet_id, ue.app_id
    from ledger_entries le
    join usage_events ue on ue.id = le.usage_event_id
    where le.wallet_id is not null
    union all
    select w.id, eu.app_id
    from wallets w
    join end_users eu
      on w.owner_type = 'end_user'
     and eu.id = w.owner_id
  ) candidates(wallet_id, app_id)
  group by wallet_id
)
update wallets w
set app_id = wallet_apps.app_id
from wallet_apps
where wallet_apps.wallet_id = w.id
  and w.app_id is null;

update wallets
set app_id = (select min(id) from apps)
where app_id is null
  and (select count(*) from apps) = 1;

update provider_credentials pc
set app_id = eu.app_id
from end_users eu
where pc.app_id is null
  and pc.owner_type = 'end_user'
  and pc.owner_id = eu.id;

update provider_credentials pc
set app_id = apps.id
from apps
where pc.app_id is null
  and pc.owner_type = 'app'
  and pc.owner_id = apps.id;

update provider_credentials
set app_id = (select min(id) from apps)
where app_id is null
  and (select count(*) from apps) = 1;

do $$
begin
  if exists (
    select default_pricing_policy_id
    from apps
    where default_pricing_policy_id is not null
    group by default_pricing_policy_id
    having count(distinct id) > 1
  ) then
    raise exception 'A pricing policy is the default for more than one app; clone it before migration.';
  end if;
end
$$;

update pricing_policies policies
set app_id = apps.id
from apps
where policies.app_id is null
  and apps.default_pricing_policy_id = policies.id;

update pricing_policies
set app_id = (select min(id) from apps)
where app_id is null
  and (select count(*) from apps) = 1;

update ledger_entries le
set app_id = ue.app_id
from usage_events ue
where le.app_id is null
  and le.usage_event_id = ue.id;

update ledger_entries le
set app_id = w.app_id
from wallets w
where le.app_id is null
  and le.wallet_id = w.id;

do $$
begin
  if exists (select 1 from wallets where app_id is null) then
    raise exception 'Wallet app ownership is ambiguous; assign app_id before migration.';
  end if;

  if exists (select 1 from provider_credentials where app_id is null) then
    raise exception 'Credential app ownership is ambiguous; assign app_id before migration.';
  end if;

  if exists (select 1 from ledger_entries where app_id is null) then
    raise exception 'Ledger entry app ownership is ambiguous; assign app_id before migration.';
  end if;

  if exists (select 1 from pricing_policies where app_id is null) then
    raise exception 'Pricing policy app ownership is ambiguous; assign app_id before migration.';
  end if;
end
$$;

alter table wallets alter column app_id set not null;
alter table provider_credentials alter column app_id set not null;
alter table ledger_entries alter column app_id set not null;
alter table pricing_policies alter column app_id set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'wallets_app_fk') then
    alter table wallets
      add constraint wallets_app_fk foreign key (app_id) references apps(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'provider_credentials_app_fk') then
    alter table provider_credentials
      add constraint provider_credentials_app_fk foreign key (app_id) references apps(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ledger_entries_app_fk') then
    alter table ledger_entries
      add constraint ledger_entries_app_fk foreign key (app_id) references apps(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'channels_app_id_id_unique') then
    alter table channels
      add constraint channels_app_id_id_unique unique (app_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'end_users_app_id_id_unique') then
    alter table end_users
      add constraint end_users_app_id_id_unique unique (app_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'routes_app_id_id_unique') then
    alter table routes
      add constraint routes_app_id_id_unique unique (app_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'wallets_app_id_id_unique') then
    alter table wallets
      add constraint wallets_app_id_id_unique unique (app_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'usage_events_app_id_id_unique') then
    alter table usage_events
      add constraint usage_events_app_id_id_unique unique (app_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pricing_policies_app_id_id_unique') then
    alter table pricing_policies
      add constraint pricing_policies_app_id_id_unique unique (app_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'apps_default_route_scope_fk') then
    alter table apps
      add constraint apps_default_route_scope_fk
      foreign key (id, default_route_id) references routes(app_id, id)
      deferrable initially deferred;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'apps_default_pricing_policy_scope_fk') then
    alter table apps
      add constraint apps_default_pricing_policy_scope_fk
      foreign key (id, default_pricing_policy_id) references pricing_policies(app_id, id)
      deferrable initially deferred;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'sessions_app_channel_fk') then
    alter table sessions
      add constraint sessions_app_channel_fk
      foreign key (app_id, channel_id) references channels(app_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sessions_app_end_user_fk') then
    alter table sessions
      add constraint sessions_app_end_user_fk
      foreign key (app_id, end_user_id) references end_users(app_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'faucet_grants_app_channel_fk') then
    alter table faucet_grants
      add constraint faucet_grants_app_channel_fk
      foreign key (app_id, channel_id) references channels(app_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'faucet_grants_app_end_user_fk') then
    alter table faucet_grants
      add constraint faucet_grants_app_end_user_fk
      foreign key (app_id, end_user_id) references end_users(app_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'faucet_grants_app_wallet_fk') then
    alter table faucet_grants
      add constraint faucet_grants_app_wallet_fk
      foreign key (app_id, wallet_id) references wallets(app_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'usage_events_app_channel_fk') then
    alter table usage_events
      add constraint usage_events_app_channel_fk
      foreign key (app_id, channel_id) references channels(app_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'usage_events_app_end_user_fk') then
    alter table usage_events
      add constraint usage_events_app_end_user_fk
      foreign key (app_id, end_user_id) references end_users(app_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'usage_events_app_route_fk') then
    alter table usage_events
      add constraint usage_events_app_route_fk
      foreign key (app_id, route_id) references routes(app_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ledger_entries_app_usage_fk') then
    alter table ledger_entries
      add constraint ledger_entries_app_usage_fk
      foreign key (app_id, usage_event_id) references usage_events(app_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ledger_entries_app_wallet_fk') then
    alter table ledger_entries
      add constraint ledger_entries_app_wallet_fk
      foreign key (app_id, wallet_id) references wallets(app_id, id);
  end if;
end
$$;

create index if not exists idx_wallets_app_owner
  on wallets(app_id, owner_type, owner_id);
create index if not exists idx_provider_credentials_app_owner
  on provider_credentials(app_id, owner_type, owner_id);
create index if not exists idx_ledger_entries_app_created
  on ledger_entries(app_id, created_at);

create or replace function validate_provider_credential_scope()
returns trigger
language plpgsql
as $$
begin
  if new.owner_type = 'end_user' then
    if not exists (
      select 1
      from end_users
      where app_id = new.app_id
        and id = new.owner_id
    ) then
      raise foreign_key_violation using
        message = 'Provider credential end user does not belong to app.';
    end if;
  elsif new.owner_type = 'developer' then
    if not exists (
      select 1
      from apps
      where id = new.app_id
        and developer_id = new.owner_id
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

drop trigger if exists provider_credentials_validate_scope
  on provider_credentials;
create trigger provider_credentials_validate_scope
before insert or update of app_id, owner_type, owner_id
on provider_credentials
for each row execute function validate_provider_credential_scope();

-- Validate rows backfilled above through the same trigger used for future writes.
update provider_credentials set app_id = app_id;
