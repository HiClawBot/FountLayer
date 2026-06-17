import { PageHeader, Panel, Status } from "../../components/ui";
import { credentials } from "../../lib/console-data";

export default function CredentialsPage() {
  return (
    <div className="page">
      <PageHeader
        title="Credentials"
        eyebrow="Provider credentials are server-side or local-only."
      />
      <Panel title="Credential Inventory">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Owner</th>
                <th>Provider</th>
                <th>Storage</th>
                <th>Display</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {credentials.map((credential) => (
                <tr key={credential.id}>
                  <td>{credential.owner}</td>
                  <td>{credential.provider}</td>
                  <td>{credential.storage}</td>
                  <td className="mono">{credential.display}</td>
                  <td>
                    <Status tone="warn">{credential.status}</Status>
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
