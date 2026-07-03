import { Plus } from "lucide-react";

import { PageHeader, Panel } from "../../components/ui";
import {
  createConsoleApp,
  createConsoleChannel,
  createConsoleCredential,
  createConsoleFaucetGrant,
  createConsolePricingPolicy,
  createConsoleRoute,
  getConsoleRuntimeData,
} from "../../lib/gateway-admin";

export const dynamic = "force-dynamic";

function SubmitButton({ label }: { label: string }) {
  return (
    <button className="primary-button" type="submit">
      <Plus size={16} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input name={name} placeholder={placeholder} type={type} />
    </label>
  );
}

export default async function SetupPage() {
  const { source } = await getConsoleRuntimeData();

  return (
    <div className="page">
      <PageHeader
        title="Setup"
        eyebrow={`Create the minimum operator records for a self-hosted app path. Source: ${source}.`}
      />
      <div className="setup-grid">
        <Panel title="App">
          <form action={createConsoleApp} className="form-grid">
            <Field label="App ID" name="id" placeholder="app_acme" />
            <Field label="Name" name="name" placeholder="Acme App" />
            <Field
              label="Developer ID"
              name="developerId"
              placeholder="dev_acme"
            />
            <Field
              label="Developer Name"
              name="developerName"
              placeholder="Acme Labs"
            />
            <div className="form-actions">
              <SubmitButton label="Create app" />
            </div>
          </form>
        </Panel>

        <Panel title="Channel">
          <form action={createConsoleChannel} className="form-grid">
            <Field label="Channel ID" name="id" placeholder="channel_web" />
            <Field label="App ID" name="appId" placeholder="app_acme" />
            <Field label="Name" name="name" placeholder="Web" />
            <Field label="Type" name="type" placeholder="direct" />
            <div className="form-actions">
              <SubmitButton label="Create channel" />
            </div>
          </form>
        </Panel>

        <Panel title="Route">
          <form action={createConsoleRoute} className="form-grid">
            <Field
              label="Route ID"
              name="id"
              placeholder="route_acme_default"
            />
            <Field label="App ID" name="appId" placeholder="app_acme" />
            <Field label="Alias" name="alias" placeholder="vertical/acme" />
            <Field label="Provider" name="provider" placeholder="demo" />
            <Field label="Model" name="model" placeholder="demo-local-model" />
            <Field label="Adapter" name="adapter" placeholder="local" />
            <Field
              label="Model Allowlist"
              name="modelAllowlist"
              placeholder="demo-local-model"
            />
            <Field
              label="Max Retail Price"
              name="maxRetailPrice"
              placeholder="0.50000000"
            />
            <div className="form-actions">
              <SubmitButton label="Create route" />
            </div>
          </form>
        </Panel>

        <Panel title="Faucet Grant">
          <form action={createConsoleFaucetGrant} className="form-grid">
            <Field label="Grant ID" name="id" placeholder="grant_acme_trial" />
            <Field label="App ID" name="appId" placeholder="app_acme" />
            <Field
              label="Channel ID"
              name="channelId"
              placeholder="channel_web"
            />
            <Field
              label="End User ID"
              name="endUserId"
              placeholder="user_hash"
            />
            <Field
              label="Remaining"
              name="remaining"
              placeholder="1.00000000"
            />
            <Field
              label="Allowed Models"
              name="allowedModels"
              placeholder="vertical/acme,demo-local-model"
            />
            <Field
              label="Allowed Use Cases"
              name="allowedUseCases"
              placeholder="paper_summary"
            />
            <Field label="Daily Cap" name="dailyCap" placeholder="0.25000000" />
            <Field
              label="Expires At"
              name="expiresAt"
              placeholder="2030-01-01T00:00:00Z"
            />
            <div className="form-actions">
              <SubmitButton label="Create grant" />
            </div>
          </form>
        </Panel>

        <Panel title="Pricing Policy">
          <form action={createConsolePricingPolicy} className="form-grid">
            <Field label="Policy ID" name="id" placeholder="policy_acme" />
            <Field label="App ID" name="appId" placeholder="app_acme" />
            <Field label="Name" name="name" placeholder="Acme Pricing" />
            <Field
              label="Platform Fee"
              name="platformFeeRate"
              placeholder="0.250000"
            />
            <Field
              label="Payment Reserve"
              name="paymentFeeReserveRate"
              placeholder="0.030000"
            />
            <Field
              label="Risk Reserve"
              name="riskReserveRate"
              placeholder="0.050000"
            />
            <Field
              label="Developer Markup"
              name="developerMarkupRate"
              placeholder="0.000000"
            />
            <Field
              label="Channel Markup"
              name="channelMarkupRate"
              placeholder="0.000000"
            />
            <Field
              label="Max Markup"
              name="maxTotalMarkupRate"
              placeholder="1.000000"
            />
            <div className="form-actions">
              <SubmitButton label="Create policy" />
            </div>
          </form>
        </Panel>

        <Panel title="Credential">
          <form action={createConsoleCredential} className="form-grid">
            <Field
              label="Owner Type"
              name="ownerType"
              placeholder="developer"
            />
            <Field label="Owner ID" name="ownerId" placeholder="dev_acme" />
            <Field label="Provider" name="provider" placeholder="demo" />
            <Field label="API Key" name="apiKey" type="password" />
            <Field
              label="Daily Budget"
              name="budgetDaily"
              placeholder="5.00000000"
            />
            <Field
              label="Monthly Budget"
              name="budgetMonthly"
              placeholder="100.00000000"
            />
            <div className="form-actions">
              <SubmitButton label="Create credential" />
            </div>
          </form>
        </Panel>
      </div>
    </div>
  );
}
