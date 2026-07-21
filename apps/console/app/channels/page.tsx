import { PageHeader, Panel, Status } from "../../components/ui";
import { getConsoleRuntimeData } from "../../lib/gateway-admin";

export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  const { channels, source } = await getConsoleRuntimeData();

  return (
    <div className="page">
      <PageHeader
        title="Channels"
        eyebrow="Distribution sources attached to apps."
        source={source}
      />
      <Panel title="Channel Registry">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Channel</th>
                <th>App</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((channel) => (
                <tr key={channel.id}>
                  <td>
                    <strong>{channel.name}</strong>
                    <div className="mono">{channel.id}</div>
                  </td>
                  <td className="mono">{channel.appId}</td>
                  <td>{channel.type}</td>
                  <td>
                    <Status>{channel.status}</Status>
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
