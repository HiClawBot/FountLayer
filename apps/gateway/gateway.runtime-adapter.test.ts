import { describe, expect, it } from "vitest";

import { LiteLLMAdapter } from "@fountlayer/adapter-litellm";
import { LocalOpenAIAdapter } from "@fountlayer/adapter-local";

import { createGatewayRuntimeAdapter } from "./src/runtime-adapter";

describe("gateway runtime adapter", () => {
  it("uses the built-in server adapter for demo mode", () => {
    expect(createGatewayRuntimeAdapter({ mode: "demo" })).toBeUndefined();
  });

  it("constructs a LiteLLM adapter", () => {
    const adapter = createGatewayRuntimeAdapter({
      apiKey: "litellm-placeholder",
      baseUrl: "http://localhost:3305",
      mode: "litellm",
    });

    expect(adapter).toBeInstanceOf(LiteLLMAdapter);
  });

  it("constructs a local OpenAI-compatible adapter", () => {
    const adapter = createGatewayRuntimeAdapter({
      baseUrl: "http://127.0.0.1:3314/v1",
      mode: "local",
    });

    expect(adapter).toBeInstanceOf(LocalOpenAIAdapter);
  });
});
