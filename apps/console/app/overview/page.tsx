import { addMoney } from "@fountlayer/money";

import { Metric, PageHeader, Panel, Status } from "../../components/ui";
import { getConsoleRuntimeData } from "../../lib/gateway-admin";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const { apps, channels, faucetGrants, ledgerEntries, source, usageEvents } =
    await getConsoleRuntimeData();
  const debitTotal = addMoney(
    ...ledgerEntries
      .filter((entry) => entry.direction === "debit")
      .map((entry) => entry.amount),
  );
  const creditTotal = addMoney(
    ...ledgerEntries
      .filter((entry) => entry.direction === "credit")
      .map((entry) => entry.amount),
  );
  const faucetBalance = addMoney(
    ...faucetGrants.map((grant) => grant.remaining),
  );
  const dailyCap = addMoney(...faucetGrants.map((grant) => grant.dailyCap));
  const overviewMetrics = [
    {
      label: "Apps",
      value: String(apps.length),
      detail: `${channels.length} active channel`,
    },
    {
      label: "Faucet Balance",
      value: `$${faucetBalance}`,
      detail: `daily cap $${dailyCap}`,
    },
    {
      label: "Usage Events",
      value: String(usageEvents.length),
      detail: source === "gateway" ? "live Gateway data" : "static fallback",
    },
    {
      label: "Ledger Entries",
      value: String(ledgerEntries.length),
      detail: "debits equal credits",
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Overview"
        eyebrow="App, channel, faucet, usage, and ledger state for the MVP distribution loop."
      />
      <section className="metrics">
        {overviewMetrics.map((metric) => (
          <Metric key={metric.label} {...metric} />
        ))}
      </section>
      <div className="grid-2">
        <Panel title="Latest Usage">
          <div className="panel-body split-list">
            {usageEvents.map((event) => (
              <div className="split-row" key={event.id}>
                <div>
                  <strong>{event.model}</strong>
                  <span className="mono"> {event.requestId}</span>
                </div>
                <Status>{event.status}</Status>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Ledger Balance">
          <div className="panel-body split-list">
            <div className="split-row">
              <span>Debits</span>
              <strong className="mono">${debitTotal}</strong>
            </div>
            <div className="split-row">
              <span>Credits</span>
              <strong className="mono">${creditTotal}</strong>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
