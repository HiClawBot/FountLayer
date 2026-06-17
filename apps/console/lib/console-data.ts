export const apps = [
  {
    id: "app_pdf_reader",
    name: "PDF Reader Demo",
    developer: "Demo Developer",
    status: "active",
    defaultRoute: "vertical/paper-summary",
  },
];

export const channels = [
  {
    id: "channel_desktop",
    appId: "app_pdf_reader",
    name: "Desktop App",
    type: "direct",
    status: "active",
  },
];

export const routes = [
  {
    id: "route_paper_summary",
    alias: "vertical/paper-summary",
    provider: "demo",
    model: "demo-local-model",
    adapter: "local",
    status: "active",
  },
];

export const credentials = [
  {
    id: "cred_local_placeholder",
    owner: "self-hosted gateway",
    provider: "demo",
    storage: "server-side encrypted",
    status: "placeholder",
    display: "not configured",
  },
];

export const faucetGrants = [
  {
    id: "grant_new_user",
    sponsor: "platform",
    appId: "app_pdf_reader",
    channelId: "channel_desktop",
    endUserId: "user_hash_123",
    remaining: "1.00000000",
    allowedModels: ["vertical/paper-summary", "demo-local-model"],
    allowedUseCases: ["paper_summary"],
    dailyCap: "0.25000000",
    expiresAt: "2026-07-17T00:00:00Z",
    status: "active",
  },
];

export const pricingPolicies = [
  {
    id: "policy_default",
    appId: "app_pdf_reader",
    platformFeeRate: "25%",
    paymentFeeReserveRate: "3%",
    riskReserveRate: "5%",
    developerMarkupRate: "0%",
    channelMarkupRate: "0%",
    maxTotalMarkupRate: "100%",
  },
];

export const usageEvents = [
  {
    id: "ue_sample",
    requestId: "req_sample",
    appId: "app_pdf_reader",
    channelId: "channel_desktop",
    endUserId: "user_hash_123",
    useCase: "paper_summary",
    mode: "managed",
    model: "demo-local-model",
    inputTokens: 10,
    outputTokens: 5,
    upstreamCost: "0.00004000",
    retailPrice: "0.00005320",
    status: "success",
  },
];

export const ledgerEntries = [
  {
    id: "le_sample_1",
    usageEventId: "ue_sample",
    walletId: "wallet_faucet_new_user",
    direction: "debit",
    amount: "0.00005320",
    reason: "retail_charge",
  },
  {
    id: "le_sample_2",
    usageEventId: "ue_sample",
    walletId: "wallet_platform_revenue",
    direction: "credit",
    amount: "0.00001320",
    reason: "platform_revenue",
  },
  {
    id: "le_sample_3",
    usageEventId: "ue_sample",
    walletId: "wallet_platform_cost",
    direction: "debit",
    amount: "0.00004000",
    reason: "provider_cost",
  },
  {
    id: "le_sample_4",
    usageEventId: "ue_sample",
    walletId: "wallet_provider_payable",
    direction: "credit",
    amount: "0.00004000",
    reason: "provider_payable",
  },
];

export const overviewMetrics = [
  { label: "Apps", value: "1", detail: "1 active channel" },
  {
    label: "Faucet Balance",
    value: "$1.00000000",
    detail: "daily cap $0.25000000",
  },
  { label: "Usage Events", value: "1", detail: "sample billable request" },
  { label: "Ledger Entries", value: "4", detail: "debits equal credits" },
];
