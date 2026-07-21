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
