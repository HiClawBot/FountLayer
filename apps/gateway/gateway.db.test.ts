import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabaseSql,
  getTestDatabaseUrl,
  setupTestDatabase,
  type FountLayerSql,
} from "@fountlayer/db";
import { createFountLayer } from "@fountlayer/sdk-js";

import { buildGatewayServer } from "./src/server";
import { createPostgresGatewayStore } from "./src/store";

const runDbTests = process.env.FOUNTLAYER_RUN_DB_TESTS === "1";
const describeDb = runDbTests ? describe : describe.skip;

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
      endUserId: "user_hash_123",
      useCase: "paper_summary",
      mode: "managed",
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
});
