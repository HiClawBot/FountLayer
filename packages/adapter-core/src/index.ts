import { estimateChatTokens } from "@fountlayer/pricing";
import type { AttributionContext, ChatMessage } from "@fountlayer/protocol";

export type AdapterChatInput = {
  requestId?: string;
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  stream?: boolean;
  metadata?: Record<string, unknown>;
  attribution?: AttributionContext;
};

export type AdapterUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  totalTokens: number;
  usageEstimated: boolean;
};

export type AdapterChatOutput = {
  id: string;
  model: string;
  content: string;
  finishReason?: string;
  usage: AdapterUsage;
  raw: unknown;
};

export type AdapterChunk = {
  id?: string;
  model?: string;
  contentDelta?: string;
  finishReason?: string;
  done?: boolean;
};

export interface LLMAdapter {
  chat(input: AdapterChatInput): Promise<AdapterChatOutput>;
  healthCheck?(): Promise<void>;
  streamChat(input: AdapterChatInput): AsyncIterable<AdapterChunk>;
}

type OpenAIUsageLike = {
  prompt_tokens?: unknown;
  completion_tokens?: unknown;
  total_tokens?: unknown;
  input_tokens?: unknown;
  output_tokens?: unknown;
  cached_input_tokens?: unknown;
};

function numberField(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
}

export function estimateAdapterUsage(
  input: Pick<AdapterChatInput, "messages">,
  outputContent = "",
): AdapterUsage {
  const estimatedOutputTokens = outputContent
    ? Math.max(1, Math.ceil(outputContent.length / 4))
    : undefined;
  const estimate = estimateChatTokens(input.messages, {
    minimumOutputTokens: estimatedOutputTokens,
  });

  return {
    inputTokens: estimate.inputTokens,
    outputTokens: estimate.outputTokens,
    cachedInputTokens: estimate.cachedInputTokens,
    totalTokens: estimate.inputTokens + estimate.outputTokens,
    usageEstimated: true,
  };
}

export function mapOpenAIUsage(
  usage: OpenAIUsageLike | null | undefined,
  input: Pick<AdapterChatInput, "messages">,
  outputContent = "",
): AdapterUsage {
  if (!usage) {
    return estimateAdapterUsage(input, outputContent);
  }

  const inputTokens =
    numberField(usage.input_tokens) ?? numberField(usage.prompt_tokens);
  const outputTokens =
    numberField(usage.output_tokens) ?? numberField(usage.completion_tokens);
  const cachedInputTokens = Math.min(
    inputTokens ?? 0,
    numberField(usage.cached_input_tokens) ?? 0,
  );

  if (inputTokens === undefined || outputTokens === undefined) {
    return estimateAdapterUsage(input, outputContent);
  }

  return {
    inputTokens,
    outputTokens,
    cachedInputTokens,
    totalTokens:
      numberField(usage.total_tokens) ??
      inputTokens + outputTokens + cachedInputTokens,
    usageEstimated: false,
  };
}

export class AdapterError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "AdapterError";
  }
}
