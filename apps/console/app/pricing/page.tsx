import { PageHeader, Panel } from "../../components/ui";
import { getConsoleRuntimeData } from "../../lib/gateway-admin";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const { modelPrices, pricingPolicies, source } =
    await getConsoleRuntimeData();

  return (
    <div className="page">
      <PageHeader
        title="Pricing"
        eyebrow="Managed-mode platform fee and reserve policy."
        source={source}
      />
      <Panel title="Model Price Versions">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Provider / Model</th>
                <th>Input / 1M</th>
                <th>Output / 1M</th>
                <th>Cached Input / 1M</th>
                <th>Currency</th>
                <th>Effective</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {modelPrices.map((price) => (
                <tr key={price.id}>
                  <td>
                    <span className="mono">{price.provider}</span>
                    <br />
                    <span className="mono">{price.model}</span>
                  </td>
                  <td>{price.inputPerMtok}</td>
                  <td>{price.outputPerMtok}</td>
                  <td>{price.cachedInputPerMtok ?? "—"}</td>
                  <td>{price.currency}</td>
                  <td>
                    {price.effectiveAt
                      ? new Date(price.effectiveAt).toLocaleString("en-US", {
                          timeZone: "UTC",
                        })
                      : "Always"}
                  </td>
                  <td>{price.source ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
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
