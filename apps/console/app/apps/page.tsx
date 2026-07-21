import { PageHeader, Panel, Status } from "../../components/ui";
import { getConsoleRuntimeData } from "../../lib/gateway-admin";

export const dynamic = "force-dynamic";

export default async function AppsPage() {
  const { apps, source } = await getConsoleRuntimeData();

  return (
    <div className="page">
      <PageHeader
        title="Apps"
        eyebrow="Registered software products using FountLayer."
        source={source}
      />
      <Panel title="App Registry">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>App</th>
                <th>Developer</th>
                <th>Default Route</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr key={app.id}>
                  <td>
                    <strong>{app.name}</strong>
                    <div className="mono">{app.id}</div>
                  </td>
                  <td>{app.developer}</td>
                  <td className="mono">{app.defaultRoute}</td>
                  <td>
                    <Status>{app.status}</Status>
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
