import type { LLMAdapter } from "@fountlayer/adapter-core";
import { LiteLLMAdapter } from "@fountlayer/adapter-litellm";
import { LocalOpenAIAdapter } from "@fountlayer/adapter-local";

import type { GatewayRuntimeAdapterConfig } from "./config.js";

export function createGatewayRuntimeAdapter(
  config: GatewayRuntimeAdapterConfig,
  fetchImpl?: typeof fetch,
): LLMAdapter | undefined {
  if (config.mode === "demo") {
    return undefined;
  }

  const options = {
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    fetchImpl,
    timeoutMs: config.timeoutMs,
  };

  return config.mode === "litellm"
    ? new LiteLLMAdapter(options)
    : new LocalOpenAIAdapter(options);
}
