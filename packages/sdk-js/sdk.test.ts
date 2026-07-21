import { describe, expect, it } from "vitest";

import { createSessionTicket } from "@fountlayer/session-ticket";

import { createFountLayer } from "./src/index";

const ticketSecret = "sdk-session-ticket-test-secret-32-characters";

async function sessionTicket(
  attribution: {
    appId: string;
    channelId: string;
    endUserId: string;
    mode: "managed";
    useCase: string;
  } = {
    appId: "app_pdf_reader",
    channelId: "channel_desktop",
    endUserId: "user_hash_123",
    mode: "managed",
    useCase: "paper_summary",
  },
) {
  return createSessionTicket({ attribution, secret: ticketSecret });
}

function memoryStorage() {
  const storage = new Map<string, string>();
  return {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  };
}

describe("FountLayer SDK", () => {
  it("starts sessions and sends required attribution headers", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const sdk = createFountLayer({
      appId: "app_pdf_reader",
      channelId: "channel_desktop",
      endpoint: "http://localhost:3300/",
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init });
        return new Response(
          JSON.stringify({
            session_id: "sess_123",
            token: "fl_sess_123",
            expires_at: "2026-06-18T00:00:00Z",
          }),
          { status: 201 },
        );
      },
    });

    const ticket = await sessionTicket();
    const session = await sdk.startSession({ ticket });

    expect(session.token).toBe("fl_sess_123");
    expect(calls[0]?.url).toBe("http://localhost:3300/v1/sessions");
    expect(calls[0]?.init?.headers).toMatchObject({
      authorization: `Bearer ${ticket}`,
      "x-fl-app-id": "app_pdf_reader",
      "x-fl-channel-id": "channel_desktop",
      "x-fl-end-user-id": "user_hash_123",
      "x-fl-use-case": "paper_summary",
      "x-fl-mode": "managed",
    });
  });

  it("derives attribution from the ticket and rejects a different client scope", async () => {
    const fetchImpl = async () =>
      new Response("{}", { status: 500, statusText: "must not call" });
    const wrongAppSdk = createFountLayer({
      appId: "app_other",
      channelId: "channel_desktop",
      endpoint: "http://localhost:3300",
      fetchImpl,
    });

    await expect(
      wrongAppSdk.startSession({ ticket: await sessionTicket() }),
    ).rejects.toThrow("app/channel does not match");
    await expect(
      wrongAppSdk.startSession({ ticket: "not-a-ticket" }),
    ).rejects.toThrow("malformed");
  });

  it("uses the session token for chat and helper requests", async () => {
    const urls: string[] = [];
    const sdk = createFountLayer({
      appId: "app_pdf_reader",
      channelId: "channel_desktop",
      endpoint: "http://localhost:3300",
      fetchImpl: async (url) => {
        urls.push(String(url));

        if (String(url).endsWith("/v1/sessions")) {
          return new Response(
            JSON.stringify({
              session_id: "sess_123",
              token: "fl_sess_123",
              expires_at: "2026-06-18T00:00:00Z",
            }),
            { status: 201 },
          );
        }

        if (String(url).endsWith("/v1/balance")) {
          return new Response(
            JSON.stringify({
              currency: "USD",
              wallet_balance: "0.00000000",
              faucet_balance: "1.00000000",
              active_grants: ["grant_new_user"],
            }),
            { status: 200 },
          );
        }

        return new Response(
          JSON.stringify({
            id: "req_123",
            object: "chat.completion",
            model: "demo-local-model",
            choices: [
              {
                index: 0,
                message: { role: "assistant", content: "Summary." },
                finish_reason: "stop",
              },
            ],
            usage: {
              input_tokens: 10,
              output_tokens: 5,
              total_tokens: 15,
            },
            billing: {
              currency: "USD",
              upstream_cost: "0.00100000",
              retail_price: "0.00133000",
              paid_by: "faucet_grant",
            },
          }),
          { status: 200 },
        );
      },
    });
    const session = await sdk.startSession({ ticket: await sessionTicket() });

    await session.chat({
      model: "vertical/paper-summary",
      messages: [{ role: "user", content: "Summarize." }],
    });
    await session.getBalance();

    expect(urls).toEqual([
      "http://localhost:3300/v1/sessions",
      "http://localhost:3300/v1/chat/completions",
      "http://localhost:3300/v1/balance",
    ]);
  });

  it("sends validated idempotency keys on chat requests", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const sdk = createFountLayer({
      appId: "app_pdf_reader",
      channelId: "channel_desktop",
      endpoint: "http://localhost:3300",
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init });

        return String(url).endsWith("/v1/sessions")
          ? new Response(
              JSON.stringify({
                session_id: "sess_123",
                token: "fl_sess_123",
                expires_at: "2026-06-18T00:00:00Z",
              }),
              { status: 201 },
            )
          : new Response(
              JSON.stringify({
                id: "req_123",
                object: "chat.completion",
                model: "demo-local-model",
                choices: [
                  {
                    index: 0,
                    message: { role: "assistant", content: "Summary." },
                  },
                ],
                usage: {
                  input_tokens: 1,
                  output_tokens: 1,
                  total_tokens: 2,
                },
                billing: {
                  currency: "USD",
                  upstream_cost: "0.00000001",
                  retail_price: "0.00000001",
                  paid_by: "faucet_grant",
                },
              }),
              { status: 200 },
            );
      },
    });
    const session = await sdk.startSession({ ticket: await sessionTicket() });

    await session.chat(
      {
        model: "vertical/paper-summary",
        messages: [{ role: "user", content: "Summarize." }],
      },
      { idempotencyKey: " idem_sdk_1 " },
    );

    expect(calls[1]?.init?.headers).toMatchObject({
      "idempotency-key": "idem_sdk_1",
    });
    await expect(
      session.chat(
        {
          model: "vertical/paper-summary",
          messages: [{ role: "user", content: "Summarize." }],
        },
        { idempotencyKey: " " },
      ),
    ).rejects.toThrow("non-empty");
  });

  it("stores BYOK and local endpoint settings only in caller-provided local storage", () => {
    const storage = memoryStorage();
    const sdk = createFountLayer({
      appId: "app_pdf_reader",
      channelId: "channel_desktop",
      endpoint: "http://localhost:3300",
      storage,
    });

    sdk.setUserApiKey(" user-key-placeholder ");
    sdk.rotateUserApiKey("rotated-user-key-placeholder");
    sdk.setLocalEndpoint({
      baseUrl: "http://127.0.0.1:3314/v1/",
      apiKey: " local-placeholder ",
    });

    expect(sdk.getUserApiKey()).toBe("rotated-user-key-placeholder");
    expect(sdk.getLocalEndpoint()).toEqual({
      baseUrl: "http://127.0.0.1:3314/v1",
      apiKey: "local-placeholder",
    });

    sdk.clearUserApiKey();
    sdk.clearLocalEndpoint();

    expect(sdk.getUserApiKey()).toBeUndefined();
    expect(sdk.getLocalEndpoint()).toBeUndefined();
  });

  it("rejects empty BYOK keys and public local endpoint URLs", () => {
    const storage = memoryStorage();
    const sdk = createFountLayer({
      appId: "app_pdf_reader",
      channelId: "channel_desktop",
      endpoint: "http://localhost:3300",
      storage,
    });

    expect(() => sdk.setUserApiKey(" ")).toThrow("non-empty");
    expect(() =>
      sdk.setLocalEndpoint({
        baseUrl: "https://api.openai.example/v1",
      }),
    ).toThrow("localhost, a private LAN address, or a .local host");
  });

  it("accepts private LAN and .local endpoints for local mode", () => {
    const storage = memoryStorage();
    const sdk = createFountLayer({
      appId: "app_pdf_reader",
      channelId: "channel_desktop",
      endpoint: "http://localhost:3300",
      storage,
    });

    sdk.setLocalEndpoint({ baseUrl: "http://192.168.1.10:3314/v1" });
    expect(sdk.getLocalEndpoint()?.baseUrl).toBe("http://192.168.1.10:3314/v1");

    sdk.setLocalEndpoint({ baseUrl: "http://fountlayer-gateway.local/v1" });
    expect(sdk.getLocalEndpoint()?.baseUrl).toBe(
      "http://fountlayer-gateway.local/v1",
    );
  });

  it("fails closed before sending an unsupported streaming chat request", async () => {
    const calls: string[] = [];
    const sdk = createFountLayer({
      appId: "app_pdf_reader",
      channelId: "channel_desktop",
      endpoint: "http://localhost:3300",
      fetchImpl: async (url) => {
        calls.push(String(url));

        if (String(url).endsWith("/v1/sessions")) {
          return new Response(
            JSON.stringify({
              session_id: "sess_123",
              token: "fl_sess_123",
              expires_at: "2026-06-18T00:00:00Z",
            }),
            { status: 201 },
          );
        }

        throw new Error("Streaming must fail before a chat request is sent.");
      },
    });
    const session = await sdk.startSession({ ticket: await sessionTicket() });
    await expect(
      (async () => {
        for await (const _chunk of session.streamChat({
          model: "vertical/paper-summary",
          messages: [{ role: "user", content: "Hello" }],
        })) {
          void _chunk;
        }
      })(),
    ).rejects.toThrow("Streaming is unavailable in the external beta");
    expect(calls).toEqual(["http://localhost:3300/v1/sessions"]);
  });
});
