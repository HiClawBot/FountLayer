import {
  apps as fallbackApps,
  channels as fallbackChannels,
  credentials as fallbackCredentials,
  faucetGrants as fallbackFaucetGrants,
  ledgerEntries as fallbackLedgerEntries,
  pricingPolicies as fallbackPricingPolicies,
  routes as fallbackRoutes,
  usageEvents as fallbackUsageEvents,
} from "./console-data";

export type ConsoleApp = {
  id: string;
  name: string;
  developer: string;
  status: string;
  defaultRoute: string;
};

export type ConsoleChannel = {
  id: string;
  appId: string;
  name: string;
  type: string;
  status: string;
};

export type ConsoleRoute = {
  id: string;
  alias: string;
  provider: string;
  model: string;
  adapter: string;
  status: string;
};

export type ConsoleCredential = {
  id: string;
  owner: string;
  provider: string;
  storage: string;
  status: string;
  display: string;
};

export type ConsoleFaucetGrant = {
  id: string;
  appId: string;
  channelId: string;
  endUserId: string;
  walletId?: string;
  remaining: string;
  allowedModels: string[];
  allowedUseCases: string[];
  dailyCap: string;
  expiresAt: string;
  status: string;
};

export type ConsolePricingPolicy = {
  id: string;
  appId: string;
  platformFeeRate: string;
  paymentFeeReserveRate: string;
  riskReserveRate: string;
  developerMarkupRate: string;
  channelMarkupRate: string;
  maxTotalMarkupRate: string;
};

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
  apps: ConsoleApp[];
  channels: ConsoleChannel[];
  credentials: ConsoleCredential[];
  faucetGrants: ConsoleFaucetGrant[];
  pricingPolicies: ConsolePricingPolicy[];
  routes: ConsoleRoute[];
  usageEvents: ConsoleUsageEvent[];
  ledgerEntries: ConsoleLedgerEntry[];
  source: "gateway" | "fallback";
};

type AppsResponse = {
  apps?: ConsoleApp[];
};

type ChannelsResponse = {
  channels?: ConsoleChannel[];
};

type CredentialsResponse = {
  credentials?: ConsoleCredential[];
};

type FaucetGrantsResponse = {
  faucet_grants?: ConsoleFaucetGrant[];
};

type PricingPoliciesResponse = {
  pricing_policies?: ConsolePricingPolicy[];
};

type RoutesResponse = {
  routes?: ConsoleRoute[];
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
  "http://localhost:3300";
const gatewayAdminToken =
  process.env.CONSOLE_GATEWAY_ADMIN_TOKEN ??
  process.env.GATEWAY_ADMIN_TOKEN ??
  "";

function fallbackRuntimeData(): ConsoleRuntimeData {
  return {
    apps: fallbackApps,
    channels: fallbackChannels,
    credentials: fallbackCredentials,
    faucetGrants: fallbackFaucetGrants,
    pricingPolicies: fallbackPricingPolicies,
    routes: fallbackRoutes,
    usageEvents: fallbackUsageEvents,
    ledgerEntries: fallbackLedgerEntries as ConsoleLedgerEntry[],
    source: "fallback",
  };
}

async function fetchJson<T>(path: string): Promise<T> {
  const headers = gatewayAdminToken
    ? {
        authorization: `Bearer ${gatewayAdminToken}`,
      }
    : undefined;
  const response = await fetch(`${gatewayBaseUrl}${path}`, {
    cache: "no-store",
    headers,
    signal: AbortSignal.timeout(800),
  });

  if (!response.ok) {
    throw new Error(`Gateway Admin API returned ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getConsoleRuntimeData(): Promise<ConsoleRuntimeData> {
  try {
    const [
      apps,
      channels,
      credentials,
      faucetGrants,
      pricingPolicies,
      routes,
      usage,
      ledger,
    ] = await Promise.all([
      fetchJson<AppsResponse>("/admin/apps"),
      fetchJson<ChannelsResponse>("/admin/channels"),
      fetchJson<CredentialsResponse>("/admin/provider-credentials"),
      fetchJson<FaucetGrantsResponse>("/admin/faucet-grants"),
      fetchJson<PricingPoliciesResponse>("/admin/pricing-policies"),
      fetchJson<RoutesResponse>("/admin/routes"),
      fetchJson<UsageEventsResponse>("/admin/usage-events"),
      fetchJson<LedgerResponse>("/admin/ledger"),
    ]);

    if (!Array.isArray(apps.apps)) {
      throw new Error("Gateway apps response did not include apps.");
    }

    if (!Array.isArray(channels.channels)) {
      throw new Error("Gateway channels response did not include channels.");
    }

    if (!Array.isArray(credentials.credentials)) {
      throw new Error(
        "Gateway credentials response did not include credentials.",
      );
    }

    if (!Array.isArray(faucetGrants.faucet_grants)) {
      throw new Error("Gateway faucet response did not include faucet_grants.");
    }

    if (!Array.isArray(pricingPolicies.pricing_policies)) {
      throw new Error(
        "Gateway pricing response did not include pricing_policies.",
      );
    }

    if (!Array.isArray(routes.routes)) {
      throw new Error("Gateway routes response did not include routes.");
    }

    if (!Array.isArray(usage.usage_events)) {
      throw new Error("Gateway usage response did not include usage_events.");
    }

    if (!Array.isArray(ledger.ledger_entries)) {
      throw new Error(
        "Gateway ledger response did not include ledger_entries.",
      );
    }

    return {
      apps: apps.apps,
      channels: channels.channels,
      credentials: credentials.credentials,
      faucetGrants: faucetGrants.faucet_grants,
      pricingPolicies: pricingPolicies.pricing_policies,
      routes: routes.routes,
      usageEvents: usage.usage_events,
      ledgerEntries: ledger.ledger_entries,
      source: "gateway",
    };
  } catch {
    return fallbackRuntimeData();
  }
}
