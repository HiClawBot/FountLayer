import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { TextEncoder } from "node:util";

import { describe, expect, it } from "vitest";

import { LiteLLMAdapter, parseOpenAIEventStream } from "./src/index";

const messages = [{ role: "user" as const, content: "Summarize this paper." }];

describe("LiteLLM adapter", () => {
  it("sends OpenAI-compatible requests and maps provider usage", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const adapter = new LiteLLMAdapter({
      baseUrl: "http://localhost:3305/v1/",
      apiKey: "test-placeholder",
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init });
        return new Response(
          JSON.stringify({
            id: "chatcmpl_123",
            model: "demo-local-model",
            choices: [
              {
                message: {
                  content: "A concise summary.",
                },
                finish_reason: "stop",
              },
            ],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5,
              total_tokens: 15,
            },
          }),
          { status: 200 },
        );
      },
    });

    const output = await adapter.chat({
      model: "demo-local-model",
      messages,
      metadata: {
        routeAlias: "vertical/paper-summary",
      },
    });
    const sentBody = JSON.parse(String(calls[0]?.init?.body)) as {
      metadata?: Record<string, string>;
      model?: string;
      stream?: boolean;
    };

    expect(calls[0]?.url).toBe("http://localhost:3305/v1/chat/completions");
    expect(
      (calls[0]?.init?.headers as Record<string, string>).authorization,
    ).toBe("Bearer test-placeholder");
    expect(sentBody).toMatchObject({
      metadata: {
        routeAlias: "vertical/paper-summary",
      },
      model: "demo-local-model",
      stream: false,
    });
    expect(output.content).toBe("A concise summary.");
    expect(output.usage).toMatchObject({
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      usageEstimated: false,
    });
  });

  it("estimates usage when provider usage is missing", async () => {
    const adapter = new LiteLLMAdapter({
      baseUrl: "http://localhost:3305",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            id: "chatcmpl_123",
            model: "demo-local-model",
            choices: [
              { message: { content: "Summary." }, finish_reason: "stop" },
            ],
          }),
          { status: 200 },
        ),
    });

    const output = await adapter.chat({
      model: "demo-local-model",
      messages,
    });

    expect(output.usage.usageEstimated).toBe(true);
    expect(output.usage.inputTokens).toBeGreaterThan(0);
  });

  it("checks the authenticated OpenAI-compatible models endpoint", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const adapter = new LiteLLMAdapter({
      apiKey: "health-placeholder",
      baseUrl: "http://localhost:3305/v1/",
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init });
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      },
    });

    await adapter.healthCheck();

    expect(calls[0]?.url).toBe("http://localhost:3305/v1/models");
    expect(calls[0]?.init).toMatchObject({ method: "GET" });
    expect(
      (calls[0]?.init?.headers as Record<string, string>).authorization,
    ).toBe("Bearer health-placeholder");
  });

  it("aborts an upstream request at the configured deadline", async () => {
    const adapter = new LiteLLMAdapter({
      baseUrl: "http://localhost:3305",
      timeoutMs: 20,
      fetchImpl: async (_url, init) =>
        await new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;

          if (!signal) {
            reject(new Error("Expected an abort signal."));
            return;
          }

          const rejectWithReason = () => reject(signal.reason);

          if (signal.aborted) {
            rejectWithReason();
            return;
          }

          signal.addEventListener("abort", rejectWithReason, { once: true });
        }),
    });

    await expect(
      adapter.chat({ model: "fixture-model", messages }),
    ).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("uses the real fetch transport against an OpenAI-compatible HTTP upstream", async () => {
    let receivedAuthorization: string | undefined;
    let receivedBody: Record<string, unknown> | undefined;
    let receivedUrl: string | undefined;
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];

      for await (const chunk of request) {
        chunks.push(Buffer.from(chunk));
      }

      receivedAuthorization = request.headers.authorization;
      receivedBody = JSON.parse(
        Buffer.concat(chunks).toString("utf8"),
      ) as Record<string, unknown>;
      receivedUrl = request.url;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          id: "chatcmpl_network_fixture",
          model: "fixture-model",
          choices: [
            {
              message: { content: "Network-backed fixture summary." },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 12,
            completion_tokens: 4,
            total_tokens: 16,
          },
        }),
      );
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });

    try {
      const address = server.address() as AddressInfo;
      const adapter = new LiteLLMAdapter({
        apiKey: "network-fixture-placeholder",
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
      const output = await adapter.chat({
        model: "fixture-model",
        messages,
        metadata: { routeAlias: "vertical/paper-summary" },
      });

      expect(receivedUrl).toBe("/v1/chat/completions");
      expect(receivedAuthorization).toBe("Bearer network-fixture-placeholder");
      expect(receivedBody).toMatchObject({
        messages,
        model: "fixture-model",
        stream: false,
      });
      expect(output).toMatchObject({
        content: "Network-backed fixture summary.",
        id: "chatcmpl_network_fixture",
        model: "fixture-model",
        usage: {
          inputTokens: 12,
          outputTokens: 4,
          totalTokens: 16,
          usageEstimated: false,
        },
      });
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("parses OpenAI-compatible event streams", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"id":"1","model":"demo","choices":[{"delta":{"content":"Hel"}}]}\n\n',
          ),
        );
        controller.enqueue(
          encoder.encode(
            'data: {"id":"1","model":"demo","choices":[{"delta":{"content":"lo"},"finish_reason":"stop"}]}\n\n',
          ),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    const chunks = [];

    for await (const chunk of parseOpenAIEventStream(stream)) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      {
        id: "1",
        model: "demo",
        contentDelta: "Hel",
        finishReason: undefined,
      },
      {
        id: "1",
        model: "demo",
        contentDelta: "lo",
        finishReason: "stop",
      },
      { done: true },
    ]);
  });
});
