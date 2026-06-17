import { PageHeader, Panel, Status } from "../../components/ui";
import { getConsoleRuntimeData } from "../../lib/gateway-admin";

export const dynamic = "force-dynamic";

export default async function UsageLedgerPage() {
  const { ledgerEntries, source, usageEvents } = await getConsoleRuntimeData();

  return (
    <div className="page">
      <PageHeader
        title="Usage & Ledger"
        eyebrow={`Token flow and append-only money movement records. Source: ${source}.`}
      />
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
