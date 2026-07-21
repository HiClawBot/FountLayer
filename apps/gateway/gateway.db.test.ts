import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabaseSql,
  getTestDatabaseUrl,
  setupTestDatabase,
  type FountLayerSql,
} from "@fountlayer/db";
import { createFountLayer } from "@fountlayer/sdk-js";
import {
  createSessionTicket,
  insecureDevelopmentSessionTicketSecret,
} from "@fountlayer/session-ticket";

import { buildGatewayServer } from "./src/server";
import { createPostgresGatewayStore } from "./src/store";

const runDbTests = process.env.FOUNTLAYER_RUN_DB_TESTS === "1";
const describeDb = runDbTests ? describe : describe.skip;

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
    server = buildGatewayServer(createPostgresGatewayStore(sql));
  });

  afterEach(async () => {
    await server?.close();
    await sql?.end();
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
