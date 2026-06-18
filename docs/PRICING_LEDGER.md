# Pricing and Ledger

## Pricing Formula

```txt
upstream_cost = input_tokens * input_price + output_tokens * output_price + cached_input_tokens * cached_input_price

platform_fee = upstream_cost * platform_fee_rate
payment_fee_reserve = upstream_cost * payment_fee_reserve_rate
risk_reserve = upstream_cost * risk_reserve_rate

wholesale_price = upstream_cost + platform_fee + payment_fee_reserve + risk_reserve

developer_markup = wholesale_price * developer_markup_rate
channel_markup = wholesale_price * channel_markup_rate

retail_price = wholesale_price + developer_markup + channel_markup
```

## Default Rates

```yaml
pricing:
  managed:
    platform_fee_rate: 0.25
    payment_fee_reserve_rate: 0.03
    risk_reserve_rate: 0.05
    developer_markup_rate: 0.00
    channel_markup_rate: 0.00
    max_total_markup_rate: 1.00
  byok:
    local_direct_fee_rate: 0.00
    hosted_gateway_fee_rate: 0.05
  local:
    token_fee_rate: 0.00
```

## Ledger Principles

1. Never mutate historical financial records.
2. Refunds are reversing entries.
3. Debits must equal credits per usage event.
4. `usage_events` record token flow; `ledger_entries` record money flow.
5. The ledger must be auditable by app, channel, end user, model, and request.

## Example: Faucet-funded Managed Call

A request costs $0.0034 retail.

```txt
Debit  faucet_wallet                0.0034   reason=faucet_consumption
Credit platform_revenue_wallet      0.0034   reason=retail_revenue
Debit  platform_cost_wallet         0.0021   reason=upstream_cost
Credit provider_payable_wallet      0.0021   reason=provider_payable
Credit channel_commission_wallet    0.0003   reason=channel_commission
Debit  platform_revenue_wallet      0.0003   reason=channel_commission_payout
```

The exact accounts can be adjusted, but the principle must remain: no hidden money movement.

## Example: Wallet-funded Managed Call

When no faucet grant can pay, the end-user wallet can fund the same billable
call if it has sufficient balance. The Gateway must deduct the wallet
atomically with the usage event and ledger entries.

```txt
Debit  end_user_wallet              0.0034   reason=retail_charge
Credit platform_revenue_wallet      0.0034   reason=platform_revenue
Debit  platform_cost_wallet         0.0021   reason=provider_cost
Credit provider_payable_wallet      0.0021   reason=provider_payable
```

## Channel Commission Options

- No commission on platform-sponsored free grants.
- Reduced commission on provider-sponsored trial grants.
- Full commission on paid user consumption.
- Developer-funded grant commission is configurable.

## Settlement Exports

`@fountlayer/settlement` builds period reports from immutable ledger entries.
Each report computes debit totals, credit totals, wallet net movement, reason
totals, a balanced/unbalanced flag, deterministic CSV output, and a SHA-256
content hash for reconciliation archives.

The Worker registers a `settlement.export` job handler that accepts ledger
entries plus a period and returns the same report, CSV, and content hash through
the queue result. Job failures store a generic error code rather than raw
exception text.

## User-facing Price Display

Show at least:

```txt
Estimated tokens
Estimated price
Paid by wallet or faucet
Remaining credits
Current mode
```

For advanced users:

```txt
Upstream model cost
Platform service fee
Developer markup
Channel markup
```
