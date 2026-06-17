import {
  ledgerEntries as fallbackLedgerEntries,
  usageEvents as fallbackUsageEvents,
} from "./console-data";

export type ConsoleUsageEvent = {
  id: string;
  requestId: string;
  appId: string;
  channelId: string;
  endUserId: string;
  useCase: string;
  mode: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  upstreamCost: string;
  retailPrice: string;
  status: string;
};

export type ConsoleLedgerEntry = {
  id: string;
  usageEventId: string;
  walletId: string;
  direction: "debit" | "credit";
  amount: string;
  reason: string;
};

export type ConsoleRuntimeData = {
  usageEvents: ConsoleUsageEvent[];
  ledgerEntries: ConsoleLedgerEntry[];
  source: "gateway" | "fallback";
};

type UsageEventsResponse = {
  usage_events?: ConsoleUsageEvent[];
};

type LedgerResponse = {
  ledger_entries?: ConsoleLedgerEntry[];
};

const gatewayBaseUrl =
  process.env.CONSOLE_GATEWAY_BASE_URL ??
  process.env.GATEWAY_BASE_URL ??
  "http://localhost:8787";

function fallbackRuntimeData(): ConsoleRuntimeData {
  return {
    usageEvents: fallbackUsageEvents,
    ledgerEntries: fallbackLedgerEntries as ConsoleLedgerEntry[],
    source: "fallback",
  };
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${gatewayBaseUrl}${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(800),
  });

  if (!response.ok) {
    throw new Error(`Gateway Admin API returned ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getConsoleRuntimeData(): Promise<ConsoleRuntimeData> {
  try {
    const [usage, ledger] = await Promise.all([
      fetchJson<UsageEventsResponse>("/admin/usage-events"),
      fetchJson<LedgerResponse>("/admin/ledger"),
    ]);

    if (!Array.isArray(usage.usage_events)) {
      throw new Error("Gateway usage response did not include usage_events.");
    }

    if (!Array.isArray(ledger.ledger_entries)) {
      throw new Error(
        "Gateway ledger response did not include ledger_entries.",
      );
    }

    return {
      usageEvents: usage.usage_events,
      ledgerEntries: ledger.ledger_entries,
      source: "gateway",
    };
  } catch {
    return fallbackRuntimeData();
  }
}
