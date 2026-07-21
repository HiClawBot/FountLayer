import {
  type AnyPgColumn,
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
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
  defaultRouteId: text("default_route_id").references(
    (): AnyPgColumn => routes.id,
  ),
  defaultPricingPolicyId: text("default_pricing_policy_id").references(
    (): AnyPgColumn => pricingPolicies.id,
  ),
  allowManaged: boolean("allow_managed").default(true),
  allowByok: boolean("allow_byok").default(true),
  allowLocal: boolean("allow_local").default(true),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const channels = pgTable(
  "channels",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id),
    name: text("name").notNull(),
    type: text("type").notNull(),
    revenueSharePolicyId: text("revenue_share_policy_id"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [unique("channels_app_id_id_unique").on(table.appId, table.id)],
);

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
  (table) => [
    unique().on(table.appId, table.externalUserHash),
    unique("end_users_app_id_id_unique").on(table.appId, table.id),
  ],
);

export const wallets = pgTable(
  "wallets",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id),
    ownerType: text("owner_type").notNull(),
    ownerId: text("owner_id").notNull(),
    currency: text("currency").notNull().default("USD"),
    balanceNumeric: numeric("balance_numeric", { precision: 18, scale: 8 })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique("wallets_app_id_id_unique").on(table.appId, table.id),
    index("idx_wallets_app_owner").on(
      table.appId,
      table.ownerType,
      table.ownerId,
    ),
  ],
);

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

export const routes = pgTable(
  "routes",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references((): AnyPgColumn => apps.id),
    alias: text("alias").notNull(),
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [unique("routes_app_id_id_unique").on(table.appId, table.id)],
);

export const pricingPolicies = pgTable(
  "pricing_policies",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references((): AnyPgColumn => apps.id),
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
  },
  (table) => [
    unique("pricing_policies_app_id_id_unique").on(table.appId, table.id),
  ],
);

export const providerCredentials = pgTable(
  "provider_credentials",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id),
    ownerType: text("owner_type").notNull(),
    ownerId: text("owner_id").notNull(),
    provider: text("provider").notNull(),
    encryptedApiKey: text("encrypted_api_key").notNull(),
    keyVersion: text("key_version").notNull().default("local-v1"),
    display: text("display").notNull().default("configured"),
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
  },
  (table) => [
    index("idx_provider_credentials_app_owner").on(
      table.appId,
      table.ownerType,
      table.ownerId,
    ),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id),
    endUserId: text("end_user_id")
      .notNull()
      .references(() => endUsers.id),
    useCase: text("use_case").notNull(),
    mode: text("mode").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_sessions_token_hash").on(table.tokenHash),
    index("idx_sessions_attribution").on(
      table.appId,
      table.channelId,
      table.endUserId,
    ),
    foreignKey({
      columns: [table.appId, table.channelId],
      foreignColumns: [channels.appId, channels.id],
      name: "sessions_app_channel_fk",
    }),
    foreignKey({
      columns: [table.appId, table.endUserId],
      foreignColumns: [endUsers.appId, endUsers.id],
      name: "sessions_app_end_user_fk",
    }),
  ],
);

export const sessionTicketRedemptions = pgTable(
  "session_ticket_redemptions",
  {
    ticketIdHash: text("ticket_id_hash").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_session_ticket_redemptions_expires").on(table.expiresAt),
  ],
);

export const rateLimitCounters = pgTable(
  "rate_limit_counters",
  {
    keyHash: text("key_hash").primaryKey(),
    scope: text("scope").notNull(),
    count: integer("count").notNull(),
    resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_rate_limit_counters_reset").on(table.resetAt)],
);

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
    foreignKey({
      columns: [table.appId, table.channelId],
      foreignColumns: [channels.appId, channels.id],
      name: "faucet_grants_app_channel_fk",
    }),
    foreignKey({
      columns: [table.appId, table.endUserId],
      foreignColumns: [endUsers.appId, endUsers.id],
      name: "faucet_grants_app_end_user_fk",
    }),
    foreignKey({
      columns: [table.appId, table.walletId],
      foreignColumns: [wallets.appId, wallets.id],
      name: "faucet_grants_app_wallet_fk",
    }),
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
    unique("usage_events_app_id_id_unique").on(table.appId, table.id),
    index("idx_usage_events_app_created").on(table.appId, table.createdAt),
    index("idx_usage_events_channel_created").on(
      table.channelId,
      table.createdAt,
    ),
    index("idx_usage_events_user_created").on(table.endUserId, table.createdAt),
    foreignKey({
      columns: [table.appId, table.channelId],
      foreignColumns: [channels.appId, channels.id],
      name: "usage_events_app_channel_fk",
    }),
    foreignKey({
      columns: [table.appId, table.endUserId],
      foreignColumns: [endUsers.appId, endUsers.id],
      name: "usage_events_app_end_user_fk",
    }),
    foreignKey({
      columns: [table.appId, table.routeId],
      foreignColumns: [routes.appId, routes.id],
      name: "usage_events_app_route_fk",
    }),
  ],
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id),
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
  (table) => [
    index("idx_ledger_entries_usage_event").on(table.usageEventId),
    index("idx_ledger_entries_app_created").on(table.appId, table.createdAt),
    foreignKey({
      columns: [table.appId, table.usageEventId],
      foreignColumns: [usageEvents.appId, usageEvents.id],
      name: "ledger_entries_app_usage_fk",
    }),
    foreignKey({
      columns: [table.appId, table.walletId],
      foreignColumns: [wallets.appId, wallets.id],
      name: "ledger_entries_app_wallet_fk",
    }),
  ],
);

export const idempotencyRecords = pgTable(
  "idempotency_records",
  {
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    reservationId: text("reservation_id").notNull(),
    status: text("status").notNull().default("processing"),
    lockedUntil: timestamp("locked_until", { withTimezone: true }).notNull(),
    usageEventId: text("usage_event_id").references(() => usageEvents.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.idempotencyKey] }),
    index("idx_idempotency_records_usage_event").on(table.usageEventId),
  ],
);
