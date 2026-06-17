import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const developers = pgTable("developers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const apps = pgTable("apps", {
  id: text("id").primaryKey(),
  developerId: text("developer_id")
    .notNull()
    .references(() => developers.id),
  name: text("name").notNull(),
  defaultRouteId: text("default_route_id"),
  defaultPricingPolicyId: text("default_pricing_policy_id"),
  allowManaged: boolean("allow_managed").default(true),
  allowByok: boolean("allow_byok").default(true),
  allowLocal: boolean("allow_local").default(true),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const channels = pgTable("channels", {
  id: text("id").primaryKey(),
  appId: text("app_id")
    .notNull()
    .references(() => apps.id),
  name: text("name").notNull(),
  type: text("type").notNull(),
  revenueSharePolicyId: text("revenue_share_policy_id"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const endUsers = pgTable(
  "end_users",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id),
    externalUserHash: text("external_user_hash").notNull(),
    region: text("region"),
    riskScore: integer("risk_score").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [unique().on(table.appId, table.externalUserHash)],
);

export const wallets = pgTable("wallets", {
  id: text("id").primaryKey(),
  ownerType: text("owner_type").notNull(),
  ownerId: text("owner_id").notNull(),
  currency: text("currency").notNull().default("USD"),
  balanceNumeric: numeric("balance_numeric", { precision: 18, scale: 8 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const modelPrices = pgTable(
  "model_prices",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inputPerMtok: numeric("input_per_mtok", {
      precision: 18,
      scale: 8,
    }).notNull(),
    outputPerMtok: numeric("output_per_mtok", {
      precision: 18,
      scale: 8,
    }).notNull(),
    cachedInputPerMtok: numeric("cached_input_per_mtok", {
      precision: 18,
      scale: 8,
    }),
    currency: text("currency").notNull().default("USD"),
    source: text("source"),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [unique().on(table.provider, table.model, table.effectiveAt)],
);

export const routes = pgTable("routes", {
  id: text("id").primaryKey(),
  appId: text("app_id")
    .notNull()
    .references(() => apps.id),
  alias: text("alias").notNull(),
  config: jsonb("config").$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const pricingPolicies = pgTable("pricing_policies", {
  id: text("id").primaryKey(),
  appId: text("app_id").references(() => apps.id),
  name: text("name").notNull(),
  platformFeeRate: numeric("platform_fee_rate", {
    precision: 10,
    scale: 6,
  })
    .notNull()
    .default("0.25"),
  paymentFeeReserveRate: numeric("payment_fee_reserve_rate", {
    precision: 10,
    scale: 6,
  })
    .notNull()
    .default("0.03"),
  riskReserveRate: numeric("risk_reserve_rate", { precision: 10, scale: 6 })
    .notNull()
    .default("0.05"),
  developerMarkupRate: numeric("developer_markup_rate", {
    precision: 10,
    scale: 6,
  })
    .notNull()
    .default("0"),
  channelMarkupRate: numeric("channel_markup_rate", {
    precision: 10,
    scale: 6,
  })
    .notNull()
    .default("0"),
  maxTotalMarkupRate: numeric("max_total_markup_rate", {
    precision: 10,
    scale: 6,
  })
    .notNull()
    .default("1.00"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const providerCredentials = pgTable("provider_credentials", {
  id: text("id").primaryKey(),
  ownerType: text("owner_type").notNull(),
  ownerId: text("owner_id").notNull(),
  provider: text("provider").notNull(),
  encryptedApiKey: text("encrypted_api_key").notNull(),
  status: text("status").notNull().default("active"),
  budgetDailyNumeric: numeric("budget_daily_numeric", {
    precision: 18,
    scale: 8,
  }),
  budgetMonthlyNumeric: numeric("budget_monthly_numeric", {
    precision: 18,
    scale: 8,
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const faucetGrants = pgTable(
  "faucet_grants",
  {
    id: text("id").primaryKey(),
    sponsorType: text("sponsor_type").notNull(),
    sponsorId: text("sponsor_id"),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id),
    endUserId: text("end_user_id")
      .notNull()
      .references(() => endUsers.id),
    walletId: text("wallet_id")
      .notNull()
      .references(() => wallets.id),
    amountNumeric: numeric("amount_numeric", {
      precision: 18,
      scale: 8,
    }).notNull(),
    remainingNumeric: numeric("remaining_numeric", {
      precision: 18,
      scale: 8,
    }).notNull(),
    allowedModels: jsonb("allowed_models").$type<string[]>().notNull(),
    allowedUseCases: jsonb("allowed_use_cases").$type<string[]>().notNull(),
    dailyCapNumeric: numeric("daily_cap_numeric", {
      precision: 18,
      scale: 8,
    }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_faucet_grants_scope").on(
      table.appId,
      table.channelId,
      table.endUserId,
      table.status,
    ),
  ],
);

export const usageEvents = pgTable(
  "usage_events",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull().unique(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id),
    endUserId: text("end_user_id")
      .notNull()
      .references(() => endUsers.id),
    mode: text("mode").notNull(),
    provider: text("provider"),
    model: text("model").notNull(),
    routeId: text("route_id").references(() => routes.id),
    useCase: text("use_case").notNull(),
    inputTokens: integer("input_tokens").default(0),
    outputTokens: integer("output_tokens").default(0),
    cachedInputTokens: integer("cached_input_tokens").default(0),
    usageEstimated: boolean("usage_estimated").default(false),
    upstreamCostNumeric: numeric("upstream_cost_numeric", {
      precision: 18,
      scale: 8,
    }).default("0"),
    wholesalePriceNumeric: numeric("wholesale_price_numeric", {
      precision: 18,
      scale: 8,
    }).default("0"),
    retailPriceNumeric: numeric("retail_price_numeric", {
      precision: 18,
      scale: 8,
    }).default("0"),
    faucetGrantId: text("faucet_grant_id").references(() => faucetGrants.id),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_usage_events_app_created").on(table.appId, table.createdAt),
    index("idx_usage_events_channel_created").on(
      table.channelId,
      table.createdAt,
    ),
    index("idx_usage_events_user_created").on(table.endUserId, table.createdAt),
  ],
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: text("id").primaryKey(),
    usageEventId: text("usage_event_id").references(() => usageEvents.id),
    walletId: text("wallet_id").references(() => wallets.id),
    direction: text("direction").notNull(),
    amountNumeric: numeric("amount_numeric", {
      precision: 18,
      scale: 8,
    }).notNull(),
    reason: text("reason").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("idx_ledger_entries_usage_event").on(table.usageEventId)],
);
