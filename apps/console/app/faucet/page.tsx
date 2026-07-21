import { PageHeader, Panel, Status } from "../../components/ui";
import { getConsoleRuntimeData } from "../../lib/gateway-admin";

export const dynamic = "force-dynamic";

export default async function FaucetPage() {
  const { faucetGrants, source } = await getConsoleRuntimeData();

  return (
    <div className="page">
      <PageHeader
        title="Faucet"
        eyebrow="Bounded credits for app-native AI trials."
        source={source}
      />
      <Panel title="Active Grants">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Grant</th>
                <th>Scope</th>
                <th>Remaining</th>
                <th>Models</th>
                <th>Use Cases</th>
                <th>Daily Cap</th>
                <th>Expiration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {faucetGrants.map((grant) => (
                <tr key={grant.id}>
                  <td className="mono">{grant.id}</td>
                  <td className="mono">
                    {grant.appId}
                    <br />
                    {grant.channelId}
                  </td>
                  <td className="mono">${grant.remaining}</td>
                  <td className="mono">{grant.allowedModels.join(", ")}</td>
                  <td className="mono">{grant.allowedUseCases.join(", ")}</td>
                  <td className="mono">${grant.dailyCap}</td>
                  <td>
                    {new Date(grant.expiresAt).toLocaleDateString("en-US")}
                  </td>
                  <td>
                    <Status>{grant.status}</Status>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
