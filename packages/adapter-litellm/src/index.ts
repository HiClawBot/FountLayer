import { TextDecoder } from "node:util";

import {
  AdapterError,
  type AdapterChatInput,
  type AdapterChatOutput,
  type AdapterChunk,
  type LLMAdapter,
  mapOpenAIUsage,
} from "@fountlayer/adapter-core";

export type LiteLLMAdapterConfig = {
  baseUrl: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

type OpenAIChoice = {
  message?: {
    content?: unknown;
  };
  delta?: {
    content?: unknown;
  };
  finish_reason?: unknown;
};

type OpenAIUsage = Parameters<typeof mapOpenAIUsage>[0];

type OpenAIChatCompletion = {
  id?: unknown;
  model?: unknown;
  choices?: OpenAIChoice[];
  usage?: OpenAIUsage;
};

function chatCompletionsUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, "");

  return normalized.endsWith("/v1")
    ? `${normalized}/chat/completions`
    : `${normalized}/v1/chat/completions`;
}

function modelsUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, "");

  return normalized.endsWith("/v1")
    ? `${normalized}/models`
    : `${normalized}/v1/models`;
}

function authHeaders(apiKey: string | undefined): Record<string, string> {
  return apiKey ? { authorization: `Bearer ${apiKey}` } : {};
}

function contentFromChoice(choice: OpenAIChoice | undefined): string {
  const content = choice?.message?.content;
  return typeof content === "string" ? content : "";
}

async function assertOk(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }

  throw new AdapterError(
    `LLM adapter request failed with status ${response.status}`,
    response.status,
  );
}

export class LiteLLMAdapter implements LLMAdapter {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly config: LiteLLMAdapterConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.timeoutMs = Math.max(1, config.timeoutMs ?? 30_000);
  }

  private requestSignal(signal?: AbortSignal): AbortSignal {
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);

    return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  }

  async healthCheck(): Promise<void> {
    const response = await this.fetchImpl(modelsUrl(this.config.baseUrl), {
      headers: {
        ...authHeaders(this.config.apiKey),
        ...this.config.headers,
      },
      method: "GET",
      signal: this.requestSignal(),
    });
    await assertOk(response);
    await response.body?.cancel();
  }

  async chat(input: AdapterChatInput): Promise<AdapterChatOutput> {
    const response = await this.fetchImpl(
      chatCompletionsUrl(this.config.baseUrl),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...authHeaders(this.config.apiKey),
          ...this.config.headers,
        },
        body: JSON.stringify({
          model: input.model,
          messages: input.messages,
          stream: false,
          metadata: input.metadata,
        }),
        signal: this.requestSignal(input.signal),
      },
    );
    await assertOk(response);

    const raw = (await response.json()) as OpenAIChatCompletion;
    const content = contentFromChoice(raw.choices?.[0]);

    return {
      id:
        typeof raw.id === "string"
          ? raw.id
          : (input.requestId ?? "adapter_response"),
      model: typeof raw.model === "string" ? raw.model : input.model,
      content,
      finishReason:
        typeof raw.choices?.[0]?.finish_reason === "string"
          ? raw.choices[0].finish_reason
          : undefined,
      usage: mapOpenAIUsage(raw.usage, input, content),
      raw,
    };
  }

  async *streamChat(input: AdapterChatInput): AsyncIterable<AdapterChunk> {
    const response = await this.fetchImpl(
      chatCompletionsUrl(this.config.baseUrl),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...authHeaders(this.config.apiKey),
          ...this.config.headers,
        },
        body: JSON.stringify({
          model: input.model,
          messages: input.messages,
          stream: true,
          metadata: input.metadata,
        }),
        signal: this.requestSignal(input.signal),
      },
    );
    await assertOk(response);

    if (!response.body) {
      throw new AdapterError("Streaming response did not include a body.");
    }

    yield* parseOpenAIEventStream(response.body);
  }
}

export async function* parseOpenAIEventStream(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<AdapterChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed.startsWith("data:")) {
        continue;
      }

      const payload = trimmed.slice("data:".length).trim();

      if (payload === "[DONE]") {
        yield { done: true };
        continue;
      }

      const event = JSON.parse(payload) as OpenAIChatCompletion;
      const choice = event.choices?.[0];
      const content = choice?.delta?.content;

      yield {
        id: typeof event.id === "string" ? event.id : undefined,
        model: typeof event.model === "string" ? event.model : undefined,
        contentDelta: typeof content === "string" ? content : undefined,
        finishReason:
          typeof choice?.finish_reason === "string"
            ? choice.finish_reason
            : undefined,
      };
    }
  }
}
