import { Filter } from "lucide-react";

import { PageHeader, Panel, Status } from "../../components/ui";
import { getConsoleRuntimeData } from "../../lib/gateway-admin";

export const dynamic = "force-dynamic";

type UsageLedgerPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const filterKeys = [
  "app_id",
  "channel_id",
  "end_user_id",
  "status",
  "direction",
  "wallet_id",
  "usage_event_id",
  "created_from",
  "created_to",
] as const;

function searchValue(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = searchParams[key];
  const candidate = Array.isArray(value) ? value[0] : value;

  return typeof candidate === "string" ? candidate : "";
}

function buildUsageLedgerQuery(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const query = new URLSearchParams();

  for (const key of filterKeys) {
    const value = searchValue(searchParams, key).trim();

    if (value.length > 0) {
      query.set(key, value);
    }
  }

  const queryString = query.toString();

  return queryString ? `?${queryString}` : "";
}

function FilterField({
  label,
  name,
  placeholder,
  searchParams,
}: {
  label: string;
  name: string;
  placeholder?: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return (
    <label className="field compact">
      <span>{label}</span>
      <input
        defaultValue={searchValue(searchParams, name)}
        name={name}
        placeholder={placeholder}
      />
    </label>
  );
}

export default async function UsageLedgerPage({
  searchParams,
}: UsageLedgerPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const usageLedgerQuery = buildUsageLedgerQuery(resolvedSearchParams);
  const { ledgerEntries, source, usageEvents } = await getConsoleRuntimeData({
    usageLedgerQuery,
  });

  return (
    <div className="page">
      <PageHeader
        title="Usage & Ledger"
        eyebrow={`Token flow and append-only money movement records. Source: ${source}.`}
      />
      <Panel title="Filters">
        <form className="filter-grid">
          <FilterField
            label="App"
            name="app_id"
            placeholder="app_pdf_reader"
            searchParams={resolvedSearchParams}
          />
          <FilterField
            label="Channel"
            name="channel_id"
            placeholder="channel_desktop"
            searchParams={resolvedSearchParams}
          />
          <FilterField
            label="End User"
            name="end_user_id"
            placeholder="user_hash_123"
            searchParams={resolvedSearchParams}
          />
          <FilterField
            label="Status"
            name="status"
            placeholder="success"
            searchParams={resolvedSearchParams}
          />
          <FilterField
            label="Direction"
            name="direction"
            placeholder="debit"
            searchParams={resolvedSearchParams}
          />
          <FilterField
            label="Wallet"
            name="wallet_id"
            placeholder="wallet_faucet_new_user"
            searchParams={resolvedSearchParams}
          />
          <FilterField
            label="Usage Event"
            name="usage_event_id"
            placeholder="ue_sample"
            searchParams={resolvedSearchParams}
          />
          <FilterField
            label="Created From"
            name="created_from"
            placeholder="2026-07-01T00:00:00Z"
            searchParams={resolvedSearchParams}
          />
          <FilterField
            label="Created To"
            name="created_to"
            placeholder="2026-07-31T23:59:59Z"
            searchParams={resolvedSearchParams}
          />
          <div className="form-actions">
            <button className="primary-button" type="submit">
              <Filter size={16} aria-hidden="true" />
              <span>Apply filters</span>
            </button>
          </div>
        </form>
      </Panel>
      <Panel title="Usage Events">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Request</th>
                <th>Attribution</th>
                <th>Mode</th>
                <th>Model</th>
                <th>Tokens</th>
                <th>Retail</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {usageEvents.map((event) => (
                <tr key={event.id}>
                  <td>
                    <strong className="mono">{event.id}</strong>
                    <div className="mono">{event.requestId}</div>
                  </td>
                  <td className="mono">
                    {event.appId}
                    <br />
                    {event.channelId}
                    <br />
                    {event.endUserId}
                  </td>
                  <td>{event.mode}</td>
                  <td className="mono">{event.model}</td>
                  <td>
                    {event.inputTokens} in / {event.outputTokens} out
                  </td>
                  <td className="mono">${event.retailPrice}</td>
                  <td>
                    <Status>{event.status}</Status>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Ledger Entries">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Entry</th>
                <th>Usage Event</th>
                <th>Wallet</th>
                <th>Direction</th>
                <th>Amount</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {ledgerEntries.map((entry) => (
                <tr key={entry.id}>
                  <td className="mono">{entry.id}</td>
                  <td className="mono">{entry.usageEventId}</td>
                  <td className="mono">{entry.walletId}</td>
                  <td>{entry.direction}</td>
                  <td className="mono">${entry.amount}</td>
                  <td>{entry.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
