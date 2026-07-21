import { PageHeader, Panel, Status } from "../../components/ui";
import { getConsoleRuntimeData } from "../../lib/gateway-admin";

export const dynamic = "force-dynamic";

export default async function RoutesPage() {
  const { routes, source } = await getConsoleRuntimeData();

  return (
    <div className="page">
      <PageHeader
        title="Routes"
        eyebrow="Model aliases and adapter targets."
        source={source}
      />
      <Panel title="Route Table">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Alias</th>
                <th>Provider</th>
                <th>Model</th>
                <th>Adapter</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((route) => (
                <tr key={route.id}>
                  <td className="mono">{route.alias}</td>
                  <td>{route.provider}</td>
                  <td className="mono">{route.model}</td>
                  <td>{route.adapter}</td>
                  <td>
                    <Status>{route.status}</Status>
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
