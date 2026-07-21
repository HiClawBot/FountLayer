import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

import {
  createDatabaseSql,
  getTestDatabaseUrl,
  runMigrations,
  seedDatabase,
  setupTestDatabase,
  type FountLayerSql,
} from "@fountlayer/db";
import { createFountLayer } from "@fountlayer/sdk-js";
import {
  createBalancedLedgerEntries,
  createUsageEvent,
} from "@fountlayer/ledger";
import {
  createSessionTicket,
  insecureDevelopmentSessionTicketSecret,
} from "@fountlayer/session-ticket";

import { buildGatewayServer } from "./src/server";
import { createPostgresGatewayStore } from "./src/store";

const runDbTests = process.env.FOUNTLAYER_RUN_DB_TESTS === "1";
const describeDb = runDbTests ? describe : describe.skip;
const adminToken = "fl_admin_database_test_token";
const adminHeaders = { authorization: `Bearer ${adminToken}` };

async function createTestSessionTicket() {
  return createSessionTicket({
    attribution: {
      appId: "app_pdf_reader",
      channelId: "channel_desktop",
      endUserId: "user_hash_123",
      mode: "managed",
      useCase: "paper_summary",
    },
    secret: insecureDevelopmentSessionTicketSecret,
  });
}

describeDb("gateway postgres store", () => {
  const databaseUrl = getTestDatabaseUrl();
  let sql: FountLayerSql | undefined;
  let server: ReturnType<typeof buildGatewayServer> | undefined;

  beforeEach(async () => {
    await setupTestDatabase(databaseUrl);
    sql = createDatabaseSql(databaseUrl);
    server = buildGatewayServer(createPostgresGatewayStore(sql), {
      adminTokenHashes: [createHash("sha256").update(adminToken).digest("hex")],
    });
  });

  afterEach(async () => {
    await server?.close();
    await sql?.end();
  });

  it("journals migrations idempotently and enforces app-scoped relations", async () => {
    if (!sql) {
      throw new Error("Postgres test database was not initialized.");
    }

    const before = await sql<Array<{ version: string; checksum: string }>>`
      select version, checksum
      from fountlayer_schema_migrations
      order by version
    `;

    await runMigrations(databaseUrl);

    const after = await sql<Array<{ version: string; checksum: string }>>`
      select version, checksum
      from fountlayer_schema_migrations
      order by version
    `;

    expect(before.map((row) => row.version)).toEqual([
      "0000_initial.sql",
      "0001_session_tickets_and_rate_limits.sql",
      "0002_app_scoped_relationships.sql",
    ]);
    expect(after).toEqual(before);
    expect(before.every((row) => /^[a-f0-9]{64}$/.test(row.checksum))).toBe(
      true,
    );

    await sql`
      insert into developers (id, name)
      values ('dev_scope_test', 'Scope Test')
    `;
    await sql`
      insert into apps (id, developer_id, name)
      values ('app_scope_test', 'dev_scope_test', 'Scope Test')
    `;
    await sql`
      insert into channels (id, app_id, name, type)
      values ('channel_scope_test', 'app_scope_test', 'Scope Test', 'direct')
    `;
    await sql`
      insert into routes (id, app_id, alias, config)
      values ('route_scope_test', 'app_scope_test', 'scope/test', ${sql.json({})})
    `;
    await sql`
      insert into pricing_policies (id, app_id, name)
      values ('policy_scope_test', 'app_scope_test', 'Scope Test')
    `;

    await expect(
      sql`
        insert into sessions (
          id,
          app_id,
          channel_id,
          end_user_id,
          use_case,
          mode,
          token_hash,
          expires_at
        )
        values (
          'sess_cross_app_test',
          'app_pdf_reader',
          'channel_scope_test',
          'user_hash_123',
          'paper_summary',
          'managed',
          'cross_app_token_hash',
          now() + interval '1 hour'
        )
      `,
    ).rejects.toMatchObject({ code: "23503" });

    await expect(
      sql`
        insert into provider_credentials (
          id,
          app_id,
          owner_type,
          owner_id,
          provider,
          encrypted_api_key,
          key_version
        )
        values (
          'cred_cross_app_test',
          'app_scope_test',
          'developer',
          'dev_demo',
          'demo',
          'encrypted-placeholder',
          'test-v1'
        )
      `,
    ).rejects.toMatchObject({ code: "23503" });

    await expect(
      sql`
        update apps
        set default_route_id = 'route_scope_test'
        where id = 'app_pdf_reader'
      `,
    ).rejects.toMatchObject({ code: "23503" });

    await expect(
      sql`
        update apps
        set default_pricing_policy_id = 'policy_scope_test'
        where id = 'app_pdf_reader'
      `,
    ).rejects.toMatchObject({ code: "23503" });

    await sql`
      update fountlayer_schema_migrations
      set checksum = ${"0".repeat(64)}
      where version = '0000_initial.sql'
    `;
    await expect(runMigrations(databaseUrl)).rejects.toThrow(
      "Applied migration checksum mismatch: 0000_initial.sql",
    );
  });

  it("creates and lists immutable model price versions", async () => {
    if (!server) {
      throw new Error("Postgres test server was not initialized.");
    }

    const created = await server.inject({
      headers: adminHeaders,
      method: "POST",
      url: "/admin/model-prices",
      payload: {
        cachedInputPerMtok: "0.10000000",
        currency: "USD",
        effectiveAt: "2026-08-01T00:00:00Z",
        id: "price_db_beta_2026_08",
        inputPerMtok: "0.30000000",
        model: "beta-db-model",
        outputPerMtok: "1.20000000",
        provider: "openai-compatible",
        source: "database-test",
      },
    });
    const listed = await server.inject({
      headers: adminHeaders,
      method: "GET",
      url: "/admin/model-prices?provider=openai-compatible&model=beta-db-model",
    });

    expect(created.statusCode).toBe(201);
    expect(created.json().model_price).toMatchObject({
      effectiveAt: "2026-08-01T00:00:00.000Z",
      id: "price_db_beta_2026_08",
      inputPerMtok: "0.30000000",
      outputPerMtok: "1.20000000",
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().model_prices).toHaveLength(1);
  });

  it("persists faucet deduction, usage event, and ledger entries", async () => {
    if (!server || !sql) {
      throw new Error("Postgres test server was not initialized.");
    }

    const sdk = createFountLayer({
      appId: "app_pdf_reader",
      channelId: "channel_desktop",
      endpoint: "http://gateway.test",
      fetchImpl: async (url, init) => {
        const injected = await server!.inject({
          method: init?.method ?? "GET",
          url: String(url).replace("http://gateway.test", ""),
          headers: init?.headers as Record<string, string>,
          payload: init?.body ? JSON.parse(String(init.body)) : undefined,
        });

        return new Response(injected.body, {
          status: injected.statusCode,
          headers: {
            "content-type":
              injected.headers["content-type"]?.toString() ??
              "application/json",
          },
        });
      },
    });
    const session = await sdk.startSession({
      ticket: await createTestSessionTicket(),
    });
    const sessionRows = await sql<Array<{ token_hash: string }>>`
      select token_hash from sessions
    `;
    const beforeBalance = await session.getBalance();

    const result = await session.chat({
      model: "vertical/paper-summary",
      messages: [{ role: "user", content: "Summarize this paper." }],
    });
    const afterBalance = await session.getBalance();
    const usageRows = await sql<Array<{ count: string }>>`
      select count(*)::text as count from usage_events
    `;
    const ledgerRows = await sql<Array<{ count: string }>>`
      select count(*)::text as count from ledger_entries
    `;
    const grantRows = await sql<Array<{ remaining: string }>>`
      select remaining_numeric::text as remaining
      from faucet_grants
      where id = 'grant_new_user'
    `;

    expect(result.billing.paid_by).toBe("faucet_grant");
    expect(result.billing.usage_event_id).toMatch(/^ue_/);
    expect(sessionRows).toHaveLength(1);
    expect(sessionRows[0]?.token_hash).not.toBe(session.token);
    expect(sessionRows[0]?.token_hash).toHaveLength(64);
    expect(Number(beforeBalance.faucet_balance)).toBe(1);
    expect(Number(afterBalance.faucet_balance)).toBeLessThan(1);
    expect(usageRows[0]?.count).toBe("1");
    expect(ledgerRows[0]?.count).toBe("4");
    expect(Number(grantRows[0]?.remaining)).toBeLessThan(1);
  });

  it("persists failed provider usage and balanced cost entries without a user debit", async () => {
    if (!sql) {
      throw new Error("Postgres test database was not initialized.");
    }

    const store = createPostgresGatewayStore(sql);
    const usageEvent = createUsageEvent({
      id: "ue_provider_cost_test",
      requestId: "req_provider_cost_test",
      attribution: {
        appId: "app_pdf_reader",
        channelId: "channel_desktop",
        endUserId: "user_hash_123",
        mode: "managed",
        useCase: "paper_summary",
      },
      provider: "demo",
      model: "demo-local-model",
      routeId: "route_paper_summary",
      inputTokens: 1,
      outputTokens: 1_000,
      upstreamCost: "0.00060015",
      wholesalePrice: "0.00079820",
      retailPrice: "0.00079820",
      status: "failed",
    });
    const ledgerEntries = createBalancedLedgerEntries({
      usageEventId: usageEvent.id,
      wallets: {
        payerWalletId: "wallet_faucet_new_user",
        platformRevenueWalletId: "wallet_platform_revenue",
        platformCostWalletId: "wallet_platform_cost",
        providerPayableWalletId: "wallet_provider_payable",
      },
      upstreamCost: usageEvent.upstreamCost,
      retailPrice: "0.00000000",
      metadata: { billingFailureReason: "actual_usage_insufficient_balance" },
    });

    await store.recordProviderCostCall({ usageEvent, ledgerEntries });

    const usageRows = await sql<Array<{ status: string }>>`
      select status from usage_events where id = ${usageEvent.id}
    `;
    const ledgerRows = await sql<
      Array<{ direction: string; reason: string; amount: string }>
    >`
      select direction, reason, amount_numeric::text as amount
      from ledger_entries
      where usage_event_id = ${usageEvent.id}
      order by reason
    `;

    expect(usageRows).toEqual([{ status: "failed" }]);
    expect(ledgerRows).toHaveLength(2);
    expect(ledgerRows).toEqual([
      {
        amount: "0.00060015",
        direction: "debit",
        reason: "provider_cost",
      },
      {
        amount: "0.00060015",
        direction: "credit",
        reason: "provider_payable",
      },
    ]);
  });

  it("does not reset stateful balances or grant status when seed is repeated", async () => {
    if (!sql) {
      throw new Error("Postgres test database was not initialized.");
    }

    await sql`
      update wallets
      set balance_numeric = 0.75000000
      where id = 'wallet_faucet_new_user'
    `;
    await sql`
      update faucet_grants
      set remaining_numeric = 0.25000000,
          status = 'revoked'
      where id = 'grant_new_user'
    `;

    await seedDatabase(databaseUrl);

    const [wallet] = await sql<Array<{ balance: string }>>`
      select balance_numeric::text as balance
      from wallets
      where id = 'wallet_faucet_new_user'
    `;
    const [grant] = await sql<Array<{ remaining: string; status: string }>>`
      select remaining_numeric::text as remaining, status
      from faucet_grants
      where id = 'grant_new_user'
    `;

    expect(wallet?.balance).toBe("0.75000000");
    expect(grant).toEqual({ remaining: "0.25000000", status: "revoked" });
  });

  it("persists wallet deduction when faucet grants cannot pay", async () => {
    if (!server || !sql) {
      throw new Error("Postgres test server was not initialized.");
    }

    await sql`
      update faucet_grants
      set status = 'revoked'
      where id = 'grant_new_user'
    `;
    await sql`
      update wallets
      set balance_numeric = 1.00000000
      where id = 'wallet_user_demo'
    `;

    const sdk = createFountLayer({
      appId: "app_pdf_reader",
      channelId: "channel_desktop",
      endpoint: "http://gateway.test",
      fetchImpl: async (url, init) => {
        const injected = await server!.inject({
          method: init?.method ?? "GET",
          url: String(url).replace("http://gateway.test", ""),
          headers: init?.headers as Record<string, string>,
          payload: init?.body ? JSON.parse(String(init.body)) : undefined,
        });

        return new Response(injected.body, {
          status: injected.statusCode,
          headers: {
            "content-type":
              injected.headers["content-type"]?.toString() ??
              "application/json",
          },
        });
      },
    });
    const session = await sdk.startSession({
      ticket: await createTestSessionTicket(),
    });
    const beforeBalance = await session.getBalance();

    const result = await session.chat({
      model: "vertical/paper-summary",
      messages: [{ role: "user", content: "Summarize this paper." }],
    });
    const afterBalance = await session.getBalance();
    const usageRows = await sql<Array<{ count: string }>>`
      select count(*)::text as count from usage_events
    `;
    const ledgerRows = await sql<Array<{ count: string }>>`
      select count(*)::text as count from ledger_entries
    `;
    const walletRows = await sql<Array<{ balance: string }>>`
      select balance_numeric::text as balance
      from wallets
      where id = 'wallet_user_demo'
    `;

    expect(result.billing.paid_by).toBe("wallet");
    expect(result.billing.usage_event_id).toMatch(/^ue_/);
    expect(beforeBalance.wallet_balance).toBe("1.00000000");
    expect(afterBalance.wallet_balance).toBe(result.billing.wallet_balance);
    expect(usageRows[0]?.count).toBe("1");
    expect(ledgerRows[0]?.count).toBe("4");
    expect(Number(walletRows[0]?.balance)).toBeLessThan(1);
  });

  it("blocks a completed idempotent request after Gateway restart", async () => {
    if (!server || !sql) {
      throw new Error("Postgres test server was not initialized.");
    }

    const sdk = createFountLayer({
      appId: "app_pdf_reader",
      channelId: "channel_desktop",
      endpoint: "http://gateway.test",
      fetchImpl: async (url, init) => {
        const injected = await server!.inject({
          method: init?.method ?? "GET",
          url: String(url).replace("http://gateway.test", ""),
          headers: init?.headers as Record<string, string>,
          payload: init?.body ? JSON.parse(String(init.body)) : undefined,
        });

        return new Response(injected.body, {
          status: injected.statusCode,
          headers: {
            "content-type":
              injected.headers["content-type"]?.toString() ??
              "application/json",
          },
        });
      },
    });
    const session = await sdk.startSession({
      ticket: await createTestSessionTicket(),
    });
    const request = {
      method: "POST" as const,
      url: "/v1/chat/completions",
      headers: {
        authorization: `Bearer ${session.token}`,
        "idempotency-key": "idem_postgres_restart",
        "x-fl-app-id": "app_pdf_reader",
        "x-fl-channel-id": "channel_desktop",
        "x-fl-end-user-id": "user_hash_123",
        "x-fl-mode": "managed",
        "x-fl-use-case": "paper_summary",
      },
      payload: {
        model: "vertical/paper-summary",
        messages: [{ role: "user", content: "Restart-safe request." }],
      },
    };
    const first = await server.inject(request);

    await server.close();
    server = buildGatewayServer(createPostgresGatewayStore(sql));
    const duplicate = await server.inject(request);
    const usageRows = await sql<Array<{ count: string }>>`
      select count(*)::text as count from usage_events
    `;
    const ledgerRows = await sql<Array<{ count: string }>>`
      select count(*)::text as count from ledger_entries
    `;
    const idempotencyRows = await sql<
      Array<{ status: string; usage_event_id: string | null }>
    >`
      select status, usage_event_id
      from idempotency_records
      where idempotency_key = 'idem_postgres_restart'
    `;

    expect(first.statusCode).toBe(200);
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe("idempotency_already_completed");
    expect(duplicate.json().error.details.usage_event_id).toBe(
      first.json().billing.usage_event_id,
    );
    expect(usageRows[0]?.count).toBe("1");
    expect(ledgerRows[0]?.count).toBe("4");
    expect(idempotencyRows).toHaveLength(1);
    expect(idempotencyRows[0]).toMatchObject({
      status: "completed",
      usage_event_id: first.json().billing.usage_event_id,
    });
  });

  it("persists ticket replay and end-user rate limits across Gateway restart", async () => {
    if (!server || !sql) {
      throw new Error("Postgres test server was not initialized.");
    }

    const rateLimits = {
      endUserBillableRequestsPerWindow: 1,
      sessionBillableRequestsPerWindow: 100,
    };
    await server.close();
    server = buildGatewayServer(createPostgresGatewayStore(sql), {
      rateLimits,
    });
    const sdk = createFountLayer({
      appId: "app_pdf_reader",
      channelId: "channel_desktop",
      endpoint: "http://gateway.test",
      fetchImpl: async (url, init) => {
        const injected = await server!.inject({
          method: init?.method ?? "GET",
          url: String(url).replace("http://gateway.test", ""),
          headers: init?.headers as Record<string, string>,
          payload: init?.body ? JSON.parse(String(init.body)) : undefined,
        });

        return new Response(injected.body, {
          status: injected.statusCode,
          headers: { "content-type": "application/json" },
        });
      },
    });
    const firstTicket = await createTestSessionTicket();
    const firstSession = await sdk.startSession({ ticket: firstTicket });
    await firstSession.chat({
      model: "vertical/paper-summary",
      messages: [{ role: "user", content: "Before restart." }],
    });

    await server.close();
    server = buildGatewayServer(createPostgresGatewayStore(sql), {
      rateLimits,
    });

    await expect(sdk.startSession({ ticket: firstTicket })).rejects.toThrow(
      "Session ticket was already redeemed.",
    );
    const secondSession = await sdk.startSession({
      ticket: await createTestSessionTicket(),
    });
    await expect(
      secondSession.chat({
        model: "vertical/paper-summary",
        messages: [{ role: "user", content: "After restart." }],
      }),
    ).rejects.toThrow("End-user billable request limit exceeded.");

    const redemptionRows = await sql<Array<{ count: string }>>`
      select count(*)::text as count from session_ticket_redemptions
    `;
    const endUserLimitRows = await sql<Array<{ count: number }>>`
      select count
      from rate_limit_counters
      where scope = 'end_user'
    `;

    expect(redemptionRows[0]?.count).toBe("2");
    expect(endUserLimitRows).toEqual([{ count: 1 }]);
  });
});
