import { Plus } from "lucide-react";

import {
  ReferenceField,
  type ReferenceOption,
} from "../../components/reference-field";
import { PageHeader, Panel } from "../../components/ui";
import {
  activateConsoleAppDefaults,
  createConsoleApp,
  createConsoleChannel,
  createConsoleCredential,
  createConsoleFaucetGrant,
  createConsoleModelPrice,
  createConsolePricingPolicy,
  createConsoleRoute,
  getConsoleRuntimeData,
} from "../../lib/gateway-admin";

export const dynamic = "force-dynamic";

function referenceOptions<T>(
  records: T[],
  toOption: (record: T) => ReferenceOption,
) {
  return records
    .map(toOption)
    .sort((left, right) => left.label.localeCompare(right.label));
}

function SubmitButton({ label }: { label: string }) {
  return (
    <button className="primary-button" type="submit">
      <Plus size={16} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function Field({
  autoComplete,
  label,
  name,
  placeholder,
  type = "text",
}: {
  autoComplete?: string;
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        autoComplete={autoComplete}
        name={name}
        placeholder={placeholder}
        type={type}
      />
    </label>
  );
}

export default async function SetupPage() {
  const { apps, channels, pricingPolicies, routes, source } =
    await getConsoleRuntimeData();
  const appOptions = referenceOptions(apps, (app) => ({
    label: `${app.name} · ${app.id}`,
    value: app.id,
  }));
  const channelOptions = referenceOptions(channels, (channel) => ({
    label: `${channel.name} · ${channel.id} (${channel.appId})`,
    value: channel.id,
  }));
  const routeOptions = referenceOptions(routes, (route) => ({
    label: `${route.alias} · ${route.id} (${route.appId})`,
    value: route.id,
  }));
  const pricingPolicyOptions = referenceOptions(pricingPolicies, (policy) => ({
    label: `${policy.id} (${policy.appId})`,
    value: policy.id,
  }));

  return (
    <div className="page">
      <PageHeader
        title="Setup"
        eyebrow="Create the minimum operator records for a self-hosted app path."
        source={source}
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
            <ReferenceField
              emptyLabel="Select an app"
              id="channel-app-id"
              label="App ID"
              name="appId"
              options={appOptions}
              placeholder="app_acme"
            />
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
            <ReferenceField
              emptyLabel="Select an app"
              id="route-app-id"
              label="App ID"
              name="appId"
              options={appOptions}
              placeholder="app_acme"
            />
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
            <ReferenceField
              emptyLabel="Select an app"
              id="grant-app-id"
              label="App ID"
              name="appId"
              options={appOptions}
              placeholder="app_acme"
            />
            <ReferenceField
              emptyLabel="Select a channel"
              id="grant-channel-id"
              label="Channel ID"
              name="channelId"
              options={channelOptions}
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
            <ReferenceField
              emptyLabel="Select an app"
              id="pricing-app-id"
              label="App ID"
              name="appId"
              options={appOptions}
              placeholder="app_acme"
            />
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
            <div className="form-actions">
              <SubmitButton label="Create policy" />
            </div>
          </form>
        </Panel>

        <Panel title="Model Price Version">
          <form action={createConsoleModelPrice} className="form-grid">
            <Field
              label="Price ID"
              name="id"
              placeholder="price_acme_model_2026_07"
            />
            <Field
              label="Provider"
              name="provider"
              placeholder="openai-compatible"
            />
            <Field label="Model" name="model" placeholder="demo-local-model" />
            <Field
              label="Input / 1M tokens"
              name="inputPerMtok"
              placeholder="0.15000000"
            />
            <Field
              label="Output / 1M tokens"
              name="outputPerMtok"
              placeholder="0.60000000"
            />
            <Field
              label="Cached input / 1M"
              name="cachedInputPerMtok"
              placeholder="0.05000000"
            />
            <Field label="Currency" name="currency" placeholder="USD" />
            <Field
              label="Effective at"
              name="effectiveAt"
              placeholder="2026-07-21T00:00:00Z"
            />
            <Field
              label="Source"
              name="source"
              placeholder="provider price sheet 2026-07"
            />
            <div className="form-actions">
              <SubmitButton label="Create price version" />
            </div>
          </form>
        </Panel>

        <Panel title="Activate App Defaults">
          <form action={activateConsoleAppDefaults} className="form-grid">
            <ReferenceField
              emptyLabel="Select an app"
              id="defaults-app-id"
              label="App ID"
              name="appId"
              options={appOptions}
              placeholder="app_acme"
            />
            <ReferenceField
              emptyLabel="Select a route"
              id="defaults-route-id"
              label="Default Route ID"
              name="defaultRouteId"
              options={routeOptions}
              placeholder="route_acme_default"
            />
            <ReferenceField
              emptyLabel="Select a pricing policy"
              id="defaults-policy-id"
              label="Default Pricing Policy ID"
              name="defaultPricingPolicyId"
              options={pricingPolicyOptions}
              placeholder="policy_acme"
            />
            <div className="form-actions">
              <SubmitButton label="Activate defaults" />
            </div>
          </form>
        </Panel>

        <Panel title="Credential">
          <form action={createConsoleCredential} className="form-grid">
            <ReferenceField
              emptyLabel="Select an app"
              id="credential-app-id"
              label="App ID"
              name="appId"
              options={appOptions}
              placeholder="app_pdf_reader"
            />
            <Field
              label="Owner Type"
              name="ownerType"
              placeholder="developer"
            />
            <Field
              autoComplete="username"
              label="Owner ID"
              name="ownerId"
              placeholder="dev_acme"
            />
            <Field label="Provider" name="provider" placeholder="demo" />
            <Field
              autoComplete="new-password"
              label="API Key"
              name="apiKey"
              type="password"
            />
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
