import postgres from "postgres";

import { getDatabaseUrl } from "./config.js";
import { isDirectRun } from "./runtime.js";

export async function seedDatabase(
  databaseUrl = getDatabaseUrl(),
): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    await sql.begin(async (transaction) => {
      await transaction`
        insert into developers (id, name, email)
        values ('dev_demo', 'Demo Developer', 'developer@example.invalid')
        on conflict (id) do update set
          name = excluded.name,
          email = excluded.email
      `;

      await transaction`
        insert into apps (
          id,
          developer_id,
          name,
          default_route_id,
          default_pricing_policy_id,
          allow_managed,
          allow_byok,
          allow_local,
          status
        )
        values (
          'app_pdf_reader',
          'dev_demo',
          'PDF Reader Demo',
          'route_paper_summary',
          'policy_default',
          true,
          false,
          false,
          'active'
        )
        on conflict (id) do update set
          name = excluded.name,
          default_route_id = excluded.default_route_id,
          default_pricing_policy_id = excluded.default_pricing_policy_id,
          allow_managed = excluded.allow_managed,
          allow_byok = excluded.allow_byok,
          allow_local = excluded.allow_local,
          status = excluded.status
      `;

      await transaction`
        insert into channels (id, app_id, name, type, status)
        values ('channel_desktop', 'app_pdf_reader', 'Desktop App', 'direct', 'active')
        on conflict (id) do update set
          name = excluded.name,
          type = excluded.type,
          status = excluded.status
      `;

      await transaction`
        insert into end_users (id, app_id, external_user_hash, region, risk_score)
        values ('user_hash_123', 'app_pdf_reader', 'user_hash_123', 'demo', 0)
        on conflict (id) do update set
          external_user_hash = excluded.external_user_hash,
          region = excluded.region,
          risk_score = excluded.risk_score
      `;

      await transaction`
        insert into wallets (id, app_id, owner_type, owner_id, currency, balance_numeric)
        values
          ('wallet_platform_revenue', 'app_pdf_reader', 'platform', 'platform', 'USD', 0),
          ('wallet_platform_cost', 'app_pdf_reader', 'platform', 'platform_cost', 'USD', 0),
          ('wallet_provider_payable', 'app_pdf_reader', 'provider_payable', 'openai-compatible', 'USD', 0),
          ('wallet_faucet_new_user', 'app_pdf_reader', 'platform', 'grant_new_user', 'USD', 1.00000000),
          ('wallet_user_demo', 'app_pdf_reader', 'end_user', 'user_hash_123', 'USD', 0)
        on conflict (id) do update set
          app_id = excluded.app_id,
          owner_type = excluded.owner_type,
          owner_id = excluded.owner_id,
          currency = excluded.currency
      `;

      await transaction`
        insert into model_prices (
          id,
          provider,
          model,
          input_per_mtok,
          output_per_mtok,
          cached_input_per_mtok,
          currency,
          source
        )
        values (
          'price_openai_compatible_model',
          'openai-compatible',
          'demo-local-model',
          0.15000000,
          0.60000000,
          0.05000000,
          'USD',
          'seed'
        )
        on conflict (id) do nothing
      `;

      await transaction`
        insert into pricing_policies (
          id,
          app_id,
          name,
          platform_fee_rate,
          payment_fee_reserve_rate,
          risk_reserve_rate,
          developer_markup_rate,
          channel_markup_rate,
          max_total_markup_rate
        )
        values (
          'policy_default',
          'app_pdf_reader',
          'Default Managed Pricing',
          0.250000,
          0.030000,
          0.050000,
          0.000000,
          0.000000,
          1.000000
        )
        on conflict (id) do update set
          name = excluded.name,
          platform_fee_rate = excluded.platform_fee_rate,
          payment_fee_reserve_rate = excluded.payment_fee_reserve_rate,
          risk_reserve_rate = excluded.risk_reserve_rate,
          developer_markup_rate = excluded.developer_markup_rate,
          channel_markup_rate = excluded.channel_markup_rate,
          max_total_markup_rate = excluded.max_total_markup_rate
      `;

      await transaction`
        insert into routes (id, app_id, alias, config, status)
        values (
          'route_paper_summary',
          'app_pdf_reader',
          'vertical/paper-summary',
          ${transaction.json({
            adapter: "litellm",
            fallbackModels: [],
            latencyPreference: "balanced",
            maxRetailPrice: "0.25000000",
            provider: "openai-compatible",
            model: "demo-local-model",
            modelAllowlist: ["demo-local-model"],
          })},
          'active'
        )
        on conflict (id) do update set
          alias = excluded.alias,
          config = excluded.config,
          status = excluded.status
      `;

      await transaction`
        insert into faucet_grants (
          id,
          sponsor_type,
          sponsor_id,
          app_id,
          channel_id,
          end_user_id,
          wallet_id,
          amount_numeric,
          remaining_numeric,
          allowed_models,
          allowed_use_cases,
          daily_cap_numeric,
          expires_at,
          status
        )
        values (
          'grant_new_user',
          'platform',
          'platform',
          'app_pdf_reader',
          'channel_desktop',
          'user_hash_123',
          'wallet_faucet_new_user',
          1.00000000,
          1.00000000,
          ${transaction.json(["vertical/paper-summary", "demo-local-model"])},
          ${transaction.json(["paper_summary"])},
          0.25000000,
          now() + interval '30 days',
          'active'
        )
        on conflict (id) do update set
          allowed_models = excluded.allowed_models,
          allowed_use_cases = excluded.allowed_use_cases,
          daily_cap_numeric = excluded.daily_cap_numeric
      `;
    });
  } finally {
    await sql.end();
  }
}

if (isDirectRun(import.meta.url)) {
  await seedDatabase();
}
