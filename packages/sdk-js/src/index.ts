import type {
  AttributionContext,
  ChatMessage,
  ChatRequest,
  FountLayerMode,
} from "@fountlayer/protocol";

export type FountLayerClientOptions = {
  appId: string;
  channelId: string;
  endpoint: string;
  fetchImpl?: typeof fetch;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
};

export type StartSessionInput = {
  endUserId: string;
  useCase: string;
  mode?: FountLayerMode;
};

export type SessionResponse = {
  session_id: string;
  token: string;
  expires_at: string;
};

export type EstimateResponse = {
  currency: string;
  model: string;
  estimated_input_tokens: number;
  estimated_output_tokens: number;
  upstream_cost: string;
  wholesale_price: string;
  retail_price: string;
  payment_source: string;
};

export type BalanceResponse = {
  currency: string;
  wallet_balance: string;
  faucet_balance: string;
  active_grants: string[];
};

export type FaucetGrantsResponse = {
  grants: Array<{
    id: string;
    remaining: string;
    allowed_models: string[];
    allowed_use_cases: string[];
    daily_cap: string;
    expires_at: string;
  }>;
};

export type ChatCompletionResponse = {
  id: string;
  object: "chat.completion";
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: "assistant";
      content: string;
    };
    finish_reason?: string;
  }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  billing: {
    currency: string;
    upstream_cost: string;
    retail_price: string;
    paid_by: string;
    faucet_remaining?: string;
    usage_event_id?: string;
    ledger_entry_count?: number;
  };
};

export type LocalEndpointConfig = {
  baseUrl: string;
  apiKey?: string;
};

type RequestBody = Record<string, unknown> | undefined;

const byokStorageKey = "fountlayer.byok.apiKey";
const localEndpointStorageKey = "fountlayer.local.endpoint";

function trimEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, "");
}

function defaultStorage():
  | Pick<Storage, "getItem" | "setItem" | "removeItem">
  | undefined {
  return typeof globalThis.localStorage !== "undefined"
    ? globalThis.localStorage
    : undefined;
}

function attributionHeaders(
  context: AttributionContext,
): Record<string, string> {
  return {
    "x-fl-app-id": context.appId,
    "x-fl-channel-id": context.channelId,
    "x-fl-end-user-id": context.endUserId,
    "x-fl-use-case": context.useCase,
    "x-fl-mode": context.mode,
  };
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as
    | T
    | { error?: { message?: string } };

  if (!response.ok) {
    const message =
      typeof (payload as { error?: { message?: string } }).error?.message ===
      "string"
        ? (payload as { error: { message: string } }).error.message
        : `FountLayer request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

export class FountLayerSession {
  constructor(
    private readonly client: FountLayerClient,
    public readonly context: AttributionContext,
    public readonly token: string,
  ) {}

  chat(input: ChatRequest): Promise<ChatCompletionResponse> {
    return this.client.request<ChatCompletionResponse>(
      "/v1/chat/completions",
      this.context,
      this.token,
      input,
    );
  }

  async *streamChat(input: ChatRequest): AsyncIterable<string> {
    const response = await this.client.rawRequest(
      "/v1/chat/completions",
      this.context,
      this.token,
      {
        ...input,
        stream: true,
      },
    );

    if (!response.body) {
      throw new Error("Streaming response did not include a body.");
    }

    const reader = response.body.getReader();
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

        const data = trimmed.slice("data:".length).trim();

        if (data === "[DONE]") {
          return;
        }

        yield data;
      }
    }
  }

  getBalance(): Promise<BalanceResponse> {
    return this.client.request<BalanceResponse>(
      "/v1/balance",
      this.context,
      this.token,
    );
  }

  getEstimatedCost(
    input: Pick<ChatRequest, "model" | "messages">,
  ): Promise<EstimateResponse> {
    return this.client.request<EstimateResponse>(
      "/v1/estimate",
      this.context,
      this.token,
      input,
    );
  }

  getAvailableFaucetGrants(): Promise<FaucetGrantsResponse> {
    return this.client.request<FaucetGrantsResponse>(
      "/v1/faucet-grants",
      this.context,
      this.token,
    );
  }
}

export class FountLayerClient {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly storage?: Pick<
    Storage,
    "getItem" | "setItem" | "removeItem"
  >;

  constructor(private readonly options: FountLayerClientOptions) {
    this.endpoint = trimEndpoint(options.endpoint);
    this.fetchImpl =
      options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
    this.storage = options.storage ?? defaultStorage();
  }

  async startSession(input: StartSessionInput): Promise<FountLayerSession> {
    const context: AttributionContext = {
      appId: this.options.appId,
      channelId: this.options.channelId,
      endUserId: input.endUserId,
      useCase: input.useCase,
      mode: input.mode ?? "managed",
    };
    const session = await this.request<SessionResponse>(
      "/v1/sessions",
      context,
      undefined,
      context,
    );

    return new FountLayerSession(this, context, session.token);
  }

  setUserApiKey(apiKey: string): void {
    if (!this.storage) {
      throw new Error("Local storage is not available for BYOK storage.");
    }

    this.storage.setItem(byokStorageKey, apiKey);
  }

  clearUserApiKey(): void {
    this.storage?.removeItem(byokStorageKey);
  }

  getUserApiKey(): string | undefined {
    return this.storage?.getItem(byokStorageKey) ?? undefined;
  }

  setLocalEndpoint(config: LocalEndpointConfig): void {
    if (!this.storage) {
      throw new Error(
        "Local storage is not available for local endpoint storage.",
      );
    }

    this.storage.setItem(localEndpointStorageKey, JSON.stringify(config));
  }

  getLocalEndpoint(): LocalEndpointConfig | undefined {
    const raw = this.storage?.getItem(localEndpointStorageKey);

    if (!raw) {
      return undefined;
    }

    return JSON.parse(raw) as LocalEndpointConfig;
  }

  request<T>(
    path: string,
    context: AttributionContext,
    token: string | undefined,
    body?: RequestBody | ChatRequest,
  ): Promise<T> {
    return this.rawRequest(path, context, token, body).then(
      parseJsonResponse<T>,
    );
  }

  async rawRequest(
    path: string,
    context: AttributionContext,
    token: string | undefined,
    body?: RequestBody | ChatRequest,
  ): Promise<Response> {
    return this.fetchImpl(`${this.endpoint}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        "content-type": "application/json",
        ...attributionHeaders(context),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}

export function createFountLayer(
  options: FountLayerClientOptions,
): FountLayerClient {
  return new FountLayerClient(options);
}

export type { ChatMessage, ChatRequest, FountLayerMode };
