import { Metric, PageHeader, Panel, Status } from "../../components/ui";
import {
  ledgerEntries,
  overviewMetrics,
  usageEvents,
} from "../../lib/console-data";

export default function OverviewPage() {
  const debitTotal = ledgerEntries
    .filter((entry) => entry.direction === "debit")
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
  const creditTotal = ledgerEntries
    .filter((entry) => entry.direction === "credit")
    .reduce((sum, entry) => sum + Number(entry.amount), 0);

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
              <strong className="mono">${debitTotal.toFixed(8)}</strong>
            </div>
            <div className="split-row">
              <span>Credits</span>
              <strong className="mono">${creditTotal.toFixed(8)}</strong>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
