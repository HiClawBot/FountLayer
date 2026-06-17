import { describe, expect, it } from "vitest";

import { createByokAdapter } from "./src/index";

describe("local OpenAI-compatible adapter", () => {
  it("supports BYOK/local endpoint requests without global provider keys", async () => {
    const calls: Array<{ init?: RequestInit }> = [];
    const adapter = createByokAdapter({
      baseUrl: "http://127.0.0.1:11434",
      apiKey: "user-local-placeholder",
      fetchImpl: async (_url, init) => {
        calls.push({ init });
        return new Response(
          JSON.stringify({
            id: "local_123",
            model: "local-model",
            choices: [{ message: { content: "Local answer." } }],
          }),
          { status: 200 },
        );
      },
    });

    const output = await adapter.chat({
      model: "local-model",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(output.content).toBe("Local answer.");
    expect(
      (calls[0]?.init?.headers as Record<string, string>).authorization,
    ).toBe("Bearer user-local-placeholder");
    expect(output.usage.usageEstimated).toBe(true);
  });
});
