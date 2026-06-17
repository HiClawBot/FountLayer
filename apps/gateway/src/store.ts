import {
  calculateDailyGrantUsage,
  findMatchingFaucetGrant,
  type FaucetRejectionReason,
} from "@fountlayer/faucet";
import type { FountLayerSql, FountLayerTransactionSql } from "@fountlayer/db";
import type { LedgerEntryRecord, UsageEventRecord } from "@fountlayer/ledger";
import type { AttributionContext } from "@fountlayer/protocol";

export type GatewayAppRecord = {
  id: string;
  status: "active" | "disabled";
  defaultRouteId: string;
};

export type GatewayChannelRecord = {
  id: string;
  appId: string;
  status: "active" | "disabled";
};

export type GatewayGrantRecord = {
  id: string;
  appId: string;
  channelId: string;
  endUserId: string;
  walletId: string;
  remaining: string;
  allowedModels: string[];
  allowedUseCases: string[];
  dailyCap: string;
  expiresAt: string;
  status: "active" | "exhausted" | "expired" | "revoked";
};

export type GatewaySessionRecord = {
  id: string;
  tokenHash: string;
  attribution: AttributionContext;
  expiresAt: string;
  revokedAt?: string;
  createdAt: string;
};

export type GatewayGrantMatch =
  | {
      matched: true;
      grant: GatewayGrantRecord;
    }
  | {
      matched: false;
      reasons: FaucetRejectionReason[];
    };

export type BillableCallRecord = {
  grantId: string;
  amount: string;
  usageEvent: UsageEventRecord;
  ledgerEntries: LedgerEntryRecord[];
  now?: Date;
};

export type BillableCallRecordResult = {
  usageEvent: UsageEventRecord;
  ledgerEntries: LedgerEntryRecord[];
  updatedGrant: GatewayGrantRecord;
};

export type GatewayStore = {
  createSession(input: {
    id: string;
    tokenHash: string;
    attribution: AttributionContext;
    expiresAt: string;
    createdAt?: string;
  }): Promise<GatewaySessionRecord>;
  getActiveSessionByTokenHash(
    tokenHash: string,
    now?: Date,
  ): Promise<GatewaySessionRecord | undefined>;
  getActiveApp(id: string): Promise<GatewayAppRecord | undefined>;
  getActiveChannel(
    appId: string,
    channelId: string,
  ): Promise<GatewayChannelRecord | undefined>;
  listActiveGrants(
    attribution: AttributionContext,
    model?: string,
  ): Promise<GatewayGrantRecord[]>;
  findPayingGrant(input: {
    attribution: AttributionContext;
    model: string;
    requestedAmount: string;
    now?: Date;
  }): Promise<GatewayGrantMatch>;
  recordBillableCall(
    input: BillableCallRecord,
  ): Promise<BillableCallRecordResult>;
  listUsageEvents(): Promise<UsageEventRecord[]>;
  listLedgerEntries(): Promise<LedgerEntryRecord[]>;
};

export type InMemoryGatewayState = {
  apps: Map<string, GatewayAppRecord>;
  channels: Map<string, GatewayChannelRecord>;
  faucetGrants: GatewayGrantRecord[];
  usageEvents: UsageEventRecord[];
  ledgerEntries: LedgerEntryRecord[];
  sessions: GatewaySessionRecord[];
};

type GrantRow = {
  id: string;
  app_id: string;
  channel_id: string;
  end_user_id: string;
  wallet_id: string;
  remaining: string;
  allowed_models: unknown;
  allowed_use_cases: unknown;
  daily_cap: string;
  expires_at: string | Date;
  status: GatewayGrantRecord["status"];
};

type UsageEventRow = {
  id: string;
  request_id: string;
  app_id: string;
  channel_id: string;
  end_user_id: string;
  mode: UsageEventRecord["mode"];
  provider: string | null;
  model: string;
  route_id: string | null;
  use_case: string;
  input_tokens: number | null;
  output_tokens: number | null;
  cached_input_tokens: number | null;
  usage_estimated: boolean | null;
  upstream_cost: string;
  wholesale_price: string;
  retail_price: string;
  faucet_grant_id: string | null;
  status: UsageEventRecord["status"];
  created_at: string | Date;
};

type LedgerEntryRow = {
  id: string;
  usage_event_id: string;
  wallet_id: string;
  direction: LedgerEntryRecord["direction"];
  amount: string;
  reason: string;
  metadata: Record<string, unknown> | null;
  created_at: string | Date;
};

type SessionRow = {
  id: string;
  app_id: string;
  channel_id: string;
  end_user_id: string;
  use_case: string;
  mode: AttributionContext["mode"];
  token_hash: string;
  expires_at: string | Date;
  revoked_at: string | Date | null;
  created_at: string | Date;
};

type JsonValue =
  | null
  | string
  | number
  | boolean
  | Date
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue | undefined };

const defaultApp: GatewayAppRecord = {
  id: "app_pdf_reader",
  status: "active",
  defaultRouteId: "route_paper_summary",
};

const defaultChannel: GatewayChannelRecord = {
  id: "channel_desktop",
  appId: "app_pdf_reader",
  status: "active",
};

const defaultGrant: GatewayGrantRecord = {
  id: "grant_new_user",
  appId: "app_pdf_reader",
  channelId: "channel_desktop",
  endUserId: "user_hash_123",
  walletId: "wallet_faucet_new_user",
  remaining: "1.00000000",
  allowedModels: ["vertical/paper-summary", "demo-local-model"],
  allowedUseCases: ["paper_summary"],
  dailyCap: "0.25000000",
  expiresAt: "2026-07-17T00:00:00Z",
  status: "active",
};

export function createDefaultInMemoryGatewayState(): InMemoryGatewayState {
  return {
    apps: new Map([[defaultApp.id, { ...defaultApp }]]),
    channels: new Map([[defaultChannel.id, { ...defaultChannel }]]),
    faucetGrants: [{ ...defaultGrant }],
    usageEvents: [],
    ledgerEntries: [],
    sessions: [],
  };
}

function money(value: number): string {
  return Math.max(0, value).toFixed(8);
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function utcDayBounds(now: Date): {
  start: Date;
  end: Date;
} {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function toJsonValue(value: Record<string, unknown>): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function mapGrantRow(row: GrantRow): GatewayGrantRecord {
  return {
    id: row.id,
    appId: row.app_id,
    channelId: row.channel_id,
    endUserId: row.end_user_id,
    walletId: row.wallet_id,
    remaining: row.remaining,
    allowedModels: asStringArray(row.allowed_models),
    allowedUseCases: asStringArray(row.allowed_use_cases),
    dailyCap: row.daily_cap,
    expiresAt: toIso(row.expires_at),
    status: row.status,
  };
}

function mapUsageEventRow(row: UsageEventRow): UsageEventRecord {
  return {
    id: row.id,
    requestId: row.request_id,
    appId: row.app_id,
    channelId: row.channel_id,
    endUserId: row.end_user_id,
    mode: row.mode,
    provider: row.provider ?? undefined,
    model: row.model,
    routeId: row.route_id ?? undefined,
    useCase: row.use_case,
    inputTokens: row.input_tokens ?? 0,
    outputTokens: row.output_tokens ?? 0,
    cachedInputTokens: row.cached_input_tokens ?? 0,
    usageEstimated: row.usage_estimated ?? false,
    upstreamCost: row.upstream_cost,
    wholesalePrice: row.wholesale_price,
    retailPrice: row.retail_price,
    faucetGrantId: row.faucet_grant_id ?? undefined,
    status: row.status,
    createdAt: toIso(row.created_at),
  };
}

function mapLedgerEntryRow(row: LedgerEntryRow): LedgerEntryRecord {
  return {
    id: row.id,
    usageEventId: row.usage_event_id,
    walletId: row.wallet_id,
    direction: row.direction,
    amount: row.amount,
    reason: row.reason,
    metadata: row.metadata ?? {},
    createdAt: toIso(row.created_at),
  };
}

function mapSessionRow(row: SessionRow): GatewaySessionRecord {
  return {
    id: row.id,
    tokenHash: row.token_hash,
    attribution: {
      appId: row.app_id,
      channelId: row.channel_id,
      endUserId: row.end_user_id,
      useCase: row.use_case,
      mode: row.mode,
    },
    expiresAt: toIso(row.expires_at),
    revokedAt: row.revoked_at ? toIso(row.revoked_at) : undefined,
    createdAt: toIso(row.created_at),
  };
}

function findGatewayGrantMatch(input: {
  grants: GatewayGrantRecord[];
  attribution: AttributionContext;
  model: string;
  requestedAmount: string;
  dailyUsageByGrantId?: Map<string, string>;
  now?: Date;
}): GatewayGrantMatch {
  const match = findMatchingFaucetGrant(input);

  if (!match.matched) {
    return match;
  }

  const grant = input.grants.find(
    (candidate) => candidate.id === match.grant.id,
  );

  if (!grant) {
    return {
      matched: false,
      reasons: ["scope_mismatch"],
    };
  }

  return {
    matched: true,
    grant,
  };
}

function listMemoryCandidateGrants(
  state: InMemoryGatewayState,
  attribution: AttributionContext,
  model?: string,
  now = new Date(),
): GatewayGrantRecord[] {
  return state.faucetGrants.filter((grant) => {
    const modelAllowed = model ? grant.allowedModels.includes(model) : true;

    return (
      grant.appId === attribution.appId &&
      grant.channelId === attribution.channelId &&
      grant.endUserId === attribution.endUserId &&
      grant.allowedUseCases.includes(attribution.useCase) &&
      modelAllowed &&
      grant.status === "active" &&
      Number(grant.remaining) > 0 &&
      Date.parse(grant.expiresAt) > now.getTime()
    );
  });
}

function memoryDailyUsageByGrantId(
  state: InMemoryGatewayState,
  grants: GatewayGrantRecord[],
  now = new Date(),
): Map<string, string> {
  const usage = new Map<string, string>();

  for (const grant of grants) {
    usage.set(
      grant.id,
      calculateDailyGrantUsage(
        state.usageEvents
          .filter((event) => event.faucetGrantId === grant.id)
          .map((event) => ({
            faucetGrantId: grant.id,
            amount: event.retailPrice,
            createdAt: event.createdAt,
            status: event.status === "refunded" ? "refunded" : "success",
          })),
        grant.id,
        now,
      ),
    );
  }

  return usage;
}

export function createInMemoryGatewayStore(
  state: InMemoryGatewayState = createDefaultInMemoryGatewayState(),
): GatewayStore {
  return {
    async createSession(input) {
      const session: GatewaySessionRecord = {
        id: input.id,
        tokenHash: input.tokenHash,
        attribution: input.attribution,
        expiresAt: input.expiresAt,
        createdAt: input.createdAt ?? new Date().toISOString(),
      };

      state.sessions.push(session);
      return session;
    },

    async getActiveSessionByTokenHash(tokenHash, now = new Date()) {
      return state.sessions.find(
        (session) =>
          session.tokenHash === tokenHash &&
          !session.revokedAt &&
          Date.parse(session.expiresAt) > now.getTime(),
      );
    },

    async getActiveApp(id) {
      const app = state.apps.get(id);
      return app?.status === "active" ? app : undefined;
    },

    async getActiveChannel(appId, channelId) {
      const channel = state.channels.get(channelId);
      return channel?.appId === appId && channel.status === "active"
        ? channel
        : undefined;
    },

    async listActiveGrants(attribution, model) {
      return listMemoryCandidateGrants(state, attribution, model);
    },

    async findPayingGrant({ attribution, model, requestedAmount, now }) {
      const grants = listMemoryCandidateGrants(state, attribution, model, now);
      return findGatewayGrantMatch({
        grants,
        attribution,
        model,
        requestedAmount,
        dailyUsageByGrantId: memoryDailyUsageByGrantId(state, grants, now),
        now,
      });
    },

    async recordBillableCall(input) {
      const grant = state.faucetGrants.find(
        (candidate) => candidate.id === input.grantId,
      );

      if (!grant) {
        throw new Error("Faucet grant no longer exists.");
      }

      const match = findGatewayGrantMatch({
        grants: [grant],
        attribution: {
          appId: input.usageEvent.appId,
          channelId: input.usageEvent.channelId,
          endUserId: input.usageEvent.endUserId,
          useCase: input.usageEvent.useCase,
          mode: input.usageEvent.mode,
        },
        model: input.usageEvent.model,
        requestedAmount: input.amount,
        dailyUsageByGrantId: memoryDailyUsageByGrantId(
          state,
          [grant],
          input.now,
        ),
        now: input.now,
      });

      if (!match.matched) {
        throw new Error(`Faucet grant rejected: ${match.reasons.join(", ")}`);
      }

      const remaining = Number(grant.remaining) - Number(input.amount);
      const updatedGrant: GatewayGrantRecord = {
        ...grant,
        remaining: money(remaining),
        status: remaining === 0 ? "exhausted" : grant.status,
      };
      const index = state.faucetGrants.findIndex(
        (candidate) => candidate.id === grant.id,
      );

      state.faucetGrants[index] = updatedGrant;
      state.usageEvents.push(input.usageEvent);
      state.ledgerEntries.push(...input.ledgerEntries);

      return {
        usageEvent: input.usageEvent,
        ledgerEntries: input.ledgerEntries,
        updatedGrant,
      };
    },

    async listUsageEvents() {
      return state.usageEvents;
    },

    async listLedgerEntries() {
      return state.ledgerEntries;
    },
  };
}

async function listPostgresCandidateGrants(
  sql: FountLayerSql | FountLayerTransactionSql,
  attribution: AttributionContext,
  options: {
    model?: string;
    lock?: boolean;
  } = {},
): Promise<GatewayGrantRecord[]> {
  const rows = options.lock
    ? await sql<GrantRow[]>`
        select
          id,
          app_id,
          channel_id,
          end_user_id,
          wallet_id,
          remaining_numeric::text as remaining,
          allowed_models,
          allowed_use_cases,
          daily_cap_numeric::text as daily_cap,
          expires_at,
          status
        from faucet_grants
        where app_id = ${attribution.appId}
          and channel_id = ${attribution.channelId}
          and end_user_id = ${attribution.endUserId}
          and status = 'active'
          and remaining_numeric > 0
          and expires_at > now()
        for update
      `
    : await sql<GrantRow[]>`
        select
          id,
          app_id,
          channel_id,
          end_user_id,
          wallet_id,
          remaining_numeric::text as remaining,
          allowed_models,
          allowed_use_cases,
          daily_cap_numeric::text as daily_cap,
          expires_at,
          status
        from faucet_grants
        where app_id = ${attribution.appId}
          and channel_id = ${attribution.channelId}
          and end_user_id = ${attribution.endUserId}
          and status = 'active'
          and remaining_numeric > 0
          and expires_at > now()
      `;
  const grants = rows.map(mapGrantRow);

  return options.model
    ? grants.filter((grant) =>
        grant.allowedModels.includes(options.model ?? ""),
      )
    : grants;
}

async function postgresDailyUsageByGrantId(
  sql: FountLayerSql | FountLayerTransactionSql,
  attribution: AttributionContext,
  now = new Date(),
): Promise<Map<string, string>> {
  const { start, end } = utcDayBounds(now);
  const rows = await sql<Array<{ faucet_grant_id: string; amount: string }>>`
    select
      faucet_grant_id,
      coalesce(sum(retail_price_numeric), 0)::text as amount
    from usage_events
    where app_id = ${attribution.appId}
      and channel_id = ${attribution.channelId}
      and end_user_id = ${attribution.endUserId}
      and status = 'success'
      and faucet_grant_id is not null
      and created_at >= ${start.toISOString()}
      and created_at < ${end.toISOString()}
    group by faucet_grant_id
  `;

  return new Map(rows.map((row) => [row.faucet_grant_id, row.amount]));
}

async function insertUsageEvent(
  sql: FountLayerTransactionSql,
  usageEvent: UsageEventRecord,
): Promise<void> {
  await sql`
    insert into usage_events (
      id,
      request_id,
      app_id,
      channel_id,
      end_user_id,
      mode,
      provider,
      model,
      route_id,
      use_case,
      input_tokens,
      output_tokens,
      cached_input_tokens,
      usage_estimated,
      upstream_cost_numeric,
      wholesale_price_numeric,
      retail_price_numeric,
      faucet_grant_id,
      status,
      created_at
    )
    values (
      ${usageEvent.id},
      ${usageEvent.requestId},
      ${usageEvent.appId},
      ${usageEvent.channelId},
      ${usageEvent.endUserId},
      ${usageEvent.mode},
      ${usageEvent.provider ?? null},
      ${usageEvent.model},
      ${usageEvent.routeId ?? null},
      ${usageEvent.useCase},
      ${usageEvent.inputTokens},
      ${usageEvent.outputTokens},
      ${usageEvent.cachedInputTokens},
      ${usageEvent.usageEstimated},
      ${usageEvent.upstreamCost},
      ${usageEvent.wholesalePrice},
      ${usageEvent.retailPrice},
      ${usageEvent.faucetGrantId ?? null},
      ${usageEvent.status},
      ${usageEvent.createdAt}
    )
  `;
}

async function insertLedgerEntries(
  sql: FountLayerTransactionSql,
  ledgerEntries: LedgerEntryRecord[],
): Promise<void> {
  for (const entry of ledgerEntries) {
    await sql`
      insert into ledger_entries (
        id,
        usage_event_id,
        wallet_id,
        direction,
        amount_numeric,
        reason,
        metadata,
        created_at
      )
      values (
        ${entry.id},
        ${entry.usageEventId},
        ${entry.walletId},
        ${entry.direction},
        ${entry.amount},
        ${entry.reason},
        ${sql.json(toJsonValue(entry.metadata))},
        ${entry.createdAt}
      )
    `;
  }
}

export function createPostgresGatewayStore(sql: FountLayerSql): GatewayStore {
  return {
    async createSession(input) {
      const rows = await sql<SessionRow[]>`
        with upsert_end_user as (
          insert into end_users (
            id,
            app_id,
            external_user_hash
          )
          values (
            ${input.attribution.endUserId},
            ${input.attribution.appId},
            ${input.attribution.endUserId}
          )
          on conflict (id) do update set
            external_user_hash = excluded.external_user_hash
          returning id
        )
        insert into sessions (
          id,
          app_id,
          channel_id,
          end_user_id,
          use_case,
          mode,
          token_hash,
          expires_at,
          created_at
        )
        values (
          ${input.id},
          ${input.attribution.appId},
          ${input.attribution.channelId},
          ${input.attribution.endUserId},
          ${input.attribution.useCase},
          ${input.attribution.mode},
          ${input.tokenHash},
          ${input.expiresAt},
          ${input.createdAt ?? new Date().toISOString()}
        )
        returning
          id,
          app_id,
          channel_id,
          end_user_id,
          use_case,
          mode,
          token_hash,
          expires_at,
          revoked_at,
          created_at
      `;
      const row = rows[0];

      if (!row) {
        throw new Error("Session was not created.");
      }

      return mapSessionRow(row);
    },

    async getActiveSessionByTokenHash(tokenHash, now = new Date()) {
      const rows = await sql<SessionRow[]>`
        select
          id,
          app_id,
          channel_id,
          end_user_id,
          use_case,
          mode,
          token_hash,
          expires_at,
          revoked_at,
          created_at
        from sessions
        where token_hash = ${tokenHash}
          and expires_at > ${now.toISOString()}
          and revoked_at is null
        limit 1
      `;
      const row = rows[0];

      return row ? mapSessionRow(row) : undefined;
    },

    async getActiveApp(id) {
      const rows = await sql<
        Array<{
          id: string;
          status: GatewayAppRecord["status"];
          default_route_id: string | null;
        }>
      >`
        select id, status, default_route_id
        from apps
        where id = ${id} and status = 'active'
        limit 1
      `;
      const row = rows[0];

      return row
        ? {
            id: row.id,
            status: row.status,
            defaultRouteId: row.default_route_id ?? "route_default",
          }
        : undefined;
    },

    async getActiveChannel(appId, channelId) {
      const rows = await sql<
        Array<{
          id: string;
          app_id: string;
          status: GatewayChannelRecord["status"];
        }>
      >`
        select id, app_id, status
        from channels
        where id = ${channelId}
          and app_id = ${appId}
          and status = 'active'
        limit 1
      `;
      const row = rows[0];

      return row
        ? {
            id: row.id,
            appId: row.app_id,
            status: row.status,
          }
        : undefined;
    },

    async listActiveGrants(attribution, model) {
      return listPostgresCandidateGrants(sql, attribution, { model });
    },

    async findPayingGrant({ attribution, model, requestedAmount, now }) {
      const grants = await listPostgresCandidateGrants(sql, attribution, {
        model,
      });

      return findGatewayGrantMatch({
        grants,
        attribution,
        model,
        requestedAmount,
        dailyUsageByGrantId: await postgresDailyUsageByGrantId(
          sql,
          attribution,
          now,
        ),
        now,
      });
    },

    async recordBillableCall(input) {
      return sql.begin(async (transaction) => {
        const attribution = {
          appId: input.usageEvent.appId,
          channelId: input.usageEvent.channelId,
          endUserId: input.usageEvent.endUserId,
          useCase: input.usageEvent.useCase,
          mode: input.usageEvent.mode,
        };
        const grants = (
          await listPostgresCandidateGrants(transaction, attribution, {
            model: input.usageEvent.model,
            lock: true,
          })
        ).filter((grant) => grant.id === input.grantId);
        const match = findGatewayGrantMatch({
          grants,
          attribution,
          model: input.usageEvent.model,
          requestedAmount: input.amount,
          dailyUsageByGrantId: await postgresDailyUsageByGrantId(
            transaction,
            attribution,
            input.now,
          ),
          now: input.now,
        });

        if (!match.matched) {
          throw new Error(`Faucet grant rejected: ${match.reasons.join(", ")}`);
        }

        const updatedRows = await transaction<GrantRow[]>`
          update faucet_grants
          set
            remaining_numeric = remaining_numeric - ${input.amount},
            status = case
              when remaining_numeric - ${input.amount} = 0 then 'exhausted'
              else status
            end
          where id = ${match.grant.id}
            and status = 'active'
            and remaining_numeric >= ${input.amount}
            and expires_at > ${input.now?.toISOString() ?? new Date().toISOString()}
          returning
            id,
            app_id,
            channel_id,
            end_user_id,
            wallet_id,
            remaining_numeric::text as remaining,
            allowed_models,
            allowed_use_cases,
            daily_cap_numeric::text as daily_cap,
            expires_at,
            status
        `;
        const updatedGrant = updatedRows[0]
          ? mapGrantRow(updatedRows[0])
          : undefined;

        if (!updatedGrant) {
          throw new Error("Faucet grant could not be deducted atomically.");
        }

        await insertUsageEvent(transaction, input.usageEvent);
        await insertLedgerEntries(transaction, input.ledgerEntries);

        return {
          usageEvent: input.usageEvent,
          ledgerEntries: input.ledgerEntries,
          updatedGrant,
        };
      });
    },

    async listUsageEvents() {
      const rows = await sql<UsageEventRow[]>`
        select
          id,
          request_id,
          app_id,
          channel_id,
          end_user_id,
          mode,
          provider,
          model,
          route_id,
          use_case,
          input_tokens,
          output_tokens,
          cached_input_tokens,
          usage_estimated,
          upstream_cost_numeric::text as upstream_cost,
          wholesale_price_numeric::text as wholesale_price,
          retail_price_numeric::text as retail_price,
          faucet_grant_id,
          status,
          created_at
        from usage_events
        order by created_at desc
      `;

      return rows.map(mapUsageEventRow);
    },

    async listLedgerEntries() {
      const rows = await sql<LedgerEntryRow[]>`
        select
          id,
          usage_event_id,
          wallet_id,
          direction,
          amount_numeric::text as amount,
          reason,
          metadata,
          created_at
        from ledger_entries
        order by created_at desc, id asc
      `;

      return rows.map(mapLedgerEntryRow);
    },
  };
}
