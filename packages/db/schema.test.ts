import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  apps,
  channels,
  faucetGrants,
  idempotencyRecords,
  ledgerEntries,
  rateLimitCounters,
  sessionTicketRedemptions,
  sessions,
  usageEvents,
} from "./src/schema";
import { migrationChecksum } from "./src/migrate";

const migrationSql = readFileSync(
  new URL("./migrations/0000_initial.sql", import.meta.url),
  "utf8",
);
const publicBoundaryMigrationSql = readFileSync(
  new URL(
    "./migrations/0001_session_tickets_and_rate_limits.sql",
    import.meta.url,
  ),
  "utf8",
);
const appScopeMigrationSql = readFileSync(
  new URL("./migrations/0002_app_scoped_relationships.sql", import.meta.url),
  "utf8",
);

describe("database migration", () => {
  it("creates the canonical MVP tables", () => {
    for (const tableName of [
      "developers",
      "apps",
      "channels",
      "end_users",
      "wallets",
      "faucet_grants",
      "model_prices",
      "usage_events",
      "ledger_entries",
      "provider_credentials",
      "sessions",
      "routes",
      "pricing_policies",
      "idempotency_records",
    ]) {
      expect(migrationSql).toContain(`create table if not exists ${tableName}`);
    }
  });

  it("keeps faucet grants bounded by balance, allowlists, daily cap, and expiration", () => {
    expect(migrationSql).toContain("app_id text not null references apps(id)");
    expect(migrationSql).toContain(
      "wallet_id text not null references wallets(id)",
    );
    expect(migrationSql).toContain("remaining_numeric numeric(18,8) not null");
    expect(migrationSql).toContain("allowed_models jsonb not null");
    expect(migrationSql).toContain("allowed_use_cases jsonb not null");
    expect(migrationSql).toContain("daily_cap_numeric numeric(18,8) not null");
    expect(migrationSql).toContain("expires_at timestamptz not null");
  });

  it("requires usage events to retain the full attribution context", () => {
    expect(migrationSql).toContain(
      "channel_id text not null references channels(id)",
    );
    expect(migrationSql).toContain(
      "end_user_id text not null references end_users(id)",
    );
    expect(migrationSql).toContain("mode text not null");
    expect(migrationSql).toContain("use_case text not null");
  });

  it("stores session tokens as hashes with full attribution and expiration", () => {
    expect(migrationSql).toContain("create table if not exists sessions");
    expect(migrationSql).toContain("token_hash text not null unique");
    expect(migrationSql).toContain("expires_at timestamptz not null");
    expect(migrationSql).toContain("revoked_at timestamptz");
    expect(migrationSql).toContain(
      "create index if not exists idx_sessions_token_hash on sessions(token_hash)",
    );
  });

  it("stores provider credentials as encrypted server-side material plus safe metadata", () => {
    expect(migrationSql).toContain(
      "create table if not exists provider_credentials",
    );
    expect(migrationSql).toContain("encrypted_api_key text not null");
    expect(migrationSql).toContain(
      "key_version text not null default 'local-v1'",
    );
    expect(migrationSql).toContain(
      "display text not null default 'configured'",
    );
  });

  it("stores durable idempotency reservations without prompt or response content", () => {
    expect(migrationSql).toContain(
      "create table if not exists idempotency_records",
    );
    expect(migrationSql).toContain("primary key(session_id, idempotency_key)");
    expect(migrationSql).toContain("request_hash text not null");
    expect(migrationSql).toContain("reservation_id text not null");
    expect(migrationSql).toContain("locked_until timestamptz not null");
    expect(migrationSql).not.toContain("prompt_text");
    expect(migrationSql).not.toContain("response_body");
  });

  it("stores one-time ticket redemptions and durable rate-limit counters", () => {
    expect(publicBoundaryMigrationSql).toContain(
      "create table if not exists session_ticket_redemptions",
    );
    expect(publicBoundaryMigrationSql).toContain(
      "ticket_id_hash text primary key",
    );
    expect(publicBoundaryMigrationSql).toContain(
      "create table if not exists rate_limit_counters",
    );
    expect(publicBoundaryMigrationSql).toContain("key_hash text primary key");
    expect(publicBoundaryMigrationSql).not.toContain("ticket text");
    expect(publicBoundaryMigrationSql).not.toContain("end_user_id");
  });

  it("journals immutable migrations by SHA-256 checksum", () => {
    expect(migrationChecksum(migrationSql)).toMatch(/^[a-f0-9]{64}$/);
    expect(migrationChecksum(migrationSql)).toBe(
      migrationChecksum(migrationSql),
    );
    expect(migrationChecksum(`${migrationSql}\n`)).not.toBe(
      migrationChecksum(migrationSql),
    );
  });

  it("enforces app-scoped session, wallet, credential, usage, and ledger relationships", () => {
    for (const constraint of [
      "sessions_app_channel_fk",
      "sessions_app_end_user_fk",
      "faucet_grants_app_wallet_fk",
      "usage_events_app_channel_fk",
      "usage_events_app_end_user_fk",
      "usage_events_app_route_fk",
      "ledger_entries_app_usage_fk",
      "ledger_entries_app_wallet_fk",
      "apps_default_route_scope_fk",
      "apps_default_pricing_policy_scope_fk",
    ]) {
      expect(appScopeMigrationSql).toContain(constraint);
    }

    expect(appScopeMigrationSql).toContain(
      "alter table wallets alter column app_id set not null",
    );
    expect(appScopeMigrationSql).toContain(
      "alter table provider_credentials alter column app_id set not null",
    );
    expect(appScopeMigrationSql).toContain(
      "alter table pricing_policies alter column app_id set not null",
    );
    expect(appScopeMigrationSql).toContain(
      "raise exception 'A wallet is linked to more than one app",
    );
    expect(appScopeMigrationSql).toContain(
      "create trigger provider_credentials_validate_scope",
    );
    expect(appScopeMigrationSql).toContain(
      "Provider credential developer does not own app.",
    );
  });
});

describe("drizzle schema exports", () => {
  it("exposes the core tables needed by gateway, faucet, usage, and ledger code", () => {
    expect(apps).toBeDefined();
    expect(channels).toBeDefined();
    expect(faucetGrants).toBeDefined();
    expect(idempotencyRecords).toBeDefined();
    expect(rateLimitCounters).toBeDefined();
    expect(sessionTicketRedemptions).toBeDefined();
    expect(sessions).toBeDefined();
    expect(usageEvents).toBeDefined();
    expect(ledgerEntries).toBeDefined();
  });
});
