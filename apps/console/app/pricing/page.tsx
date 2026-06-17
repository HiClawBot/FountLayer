import { PageHeader, Panel } from "../../components/ui";
import { pricingPolicies } from "../../lib/console-data";

export default function PricingPage() {
  return (
    <div className="page">
      <PageHeader
        title="Pricing"
        eyebrow="Managed mode pricing policy and markup controls."
      />
      <Panel title="Pricing Policies">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Policy</th>
                <th>App</th>
                <th>Platform Fee</th>
                <th>Payment Reserve</th>
                <th>Risk Reserve</th>
                <th>Developer Markup</th>
                <th>Channel Markup</th>
                <th>Max Markup</th>
              </tr>
            </thead>
            <tbody>
              {pricingPolicies.map((policy) => (
                <tr key={policy.id}>
                  <td className="mono">{policy.id}</td>
                  <td className="mono">{policy.appId}</td>
                  <td>{policy.platformFeeRate}</td>
                  <td>{policy.paymentFeeReserveRate}</td>
                  <td>{policy.riskReserveRate}</td>
                  <td>{policy.developerMarkupRate}</td>
                  <td>{policy.channelMarkupRate}</td>
                  <td>{policy.maxTotalMarkupRate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
