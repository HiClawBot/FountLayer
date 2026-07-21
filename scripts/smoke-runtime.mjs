/* global URL, console, fetch, process */

const gatewayBaseUrl = process.env.GATEWAY_BASE_URL ?? "http://localhost:3300";
const consoleBaseUrl = process.env.CONSOLE_BASE_URL ?? "http://localhost:3301";
const adminToken =
  process.env.CONSOLE_GATEWAY_ADMIN_TOKEN ??
  process.env.GATEWAY_ADMIN_TOKEN ??
  process.env.FOUNTLAYER_ADMIN_TOKEN ??
  "change_me_admin_token";
const checkConsole = process.env.FOUNTLAYER_SMOKE_CHECK_CONSOLE !== "0";
const consoleOperatorToken = process.env.CONSOLE_SMOKE_OPERATOR_TOKEN ?? "";
const gatewaySourceSignals = ["Source: gateway", "live Gateway data"];

const attributionHeaders = {
  "content-type": "application/json",
  "x-fl-app-id": "app_pdf_reader",
  "x-fl-channel-id": "channel_desktop",
  "x-fl-end-user-id": "user_hash_123",
  "x-fl-use-case": "paper_summary",
  "x-fl-mode": "managed",
};

function fail(message, details) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message,
        details,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

async function readJson(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    fail("Expected JSON response.", {
      status: response.status,
      text: text.slice(0, 200),
    });
  }
}

async function fetchRawJson(path, init) {
  const response = await fetch(`${gatewayBaseUrl}${path}`, init);
  const body = await readJson(response);

  return { response, body };
}

async function fetchJson(path, init) {
  const { response, body } = await fetchRawJson(path, init);

  if (!response.ok) {
    fail(`Gateway request failed: ${path}`, {
      status: response.status,
      body,
    });
  }

  return body;
}

async function fetchAdminJson(path) {
  return fetchJson(path, {
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
  });
}

async function smokeGateway() {
  const health = await fetchJson("/health");

  if (health.status !== "ok") {
    fail("Gateway health check did not return ok.", health);
  }

  const dependencyHealth = await fetchJson("/health/dependencies");

  if (dependencyHealth.status !== "ok") {
    fail(
      "Gateway dependency health check did not return ok.",
      dependencyHealth,
    );
  }

  const session = await fetchJson("/v1/sessions", {
    method: "POST",
    headers: attributionHeaders,
    body: JSON.stringify({
      appId: "app_pdf_reader",
      channelId: "channel_desktop",
      endUserId: "user_hash_123",
      useCase: "paper_summary",
      mode: "managed",
    }),
  });

  if (
    typeof session.token !== "string" ||
    !session.token.startsWith("fl_sess_")
  ) {
    fail("Gateway did not create a session token.");
  }

  const sessionHeaders = {
    ...attributionHeaders,
    authorization: `Bearer ${session.token}`,
  };
  const messages = [{ role: "user", content: "Summarize this paper." }];
  const estimate = await fetchJson("/v1/estimate", {
    method: "POST",
    headers: sessionHeaders,
    body: JSON.stringify({
      model: "vertical/paper-summary",
      messages,
    }),
  });

  if (Number(estimate.retail_price) <= 0) {
    fail("Gateway estimate did not return a positive retail price.", estimate);
  }

  const chat = await fetchJson("/v1/chat/completions", {
    method: "POST",
    headers: sessionHeaders,
    body: JSON.stringify({
      model: "vertical/paper-summary",
      messages,
    }),
  });

  if (!chat.billing?.usage_event_id || chat.billing.ledger_entry_count !== 4) {
    fail("Gateway chat did not produce expected billing metadata.", {
      billing: chat.billing,
    });
  }

  const [apps, channels, faucetGrants, routes, pricingPolicies, usage, ledger] =
    await Promise.all([
      fetchAdminJson("/admin/apps"),
      fetchAdminJson("/admin/channels"),
      fetchAdminJson("/admin/faucet-grants"),
      fetchAdminJson("/admin/routes"),
      fetchAdminJson("/admin/pricing-policies"),
      fetchAdminJson("/admin/usage-events"),
      fetchAdminJson("/admin/ledger"),
    ]);

  const checks = {
    apps: apps.apps?.length,
    channels: channels.channels?.length,
    faucetGrants: faucetGrants.faucet_grants?.length,
    routes: routes.routes?.length,
    pricingPolicies: pricingPolicies.pricing_policies?.length,
    usageEvents: usage.usage_events?.length,
    ledgerEntries: ledger.ledger_entries?.length,
  };

  if (
    !checks.apps ||
    !checks.channels ||
    !checks.faucetGrants ||
    !checks.routes ||
    !checks.pricingPolicies ||
    !checks.usageEvents ||
    (checks.ledgerEntries ?? 0) < 4
  ) {
    fail("Admin readback did not include expected runtime data.", checks);
  }

  const denied = await fetchRawJson("/v1/chat/completions", {
    method: "POST",
    headers: sessionHeaders,
    body: JSON.stringify({
      model: "route/not-configured",
      messages,
    }),
  });

  if (denied.response.ok) {
    fail("Denied route unexpectedly returned success.", denied.body);
  }

  const [usageAfterDenied, ledgerAfterDenied] = await Promise.all([
    fetchAdminJson("/admin/usage-events"),
    fetchAdminJson("/admin/ledger"),
  ]);
  const usageCountAfterDenied = usageAfterDenied.usage_events?.length ?? 0;
  const ledgerCountAfterDenied = ledgerAfterDenied.ledger_entries?.length ?? 0;

  if (
    usageCountAfterDenied !== checks.usageEvents ||
    ledgerCountAfterDenied !== checks.ledgerEntries
  ) {
    fail("Denied route created usage or ledger records.", {
      before: {
        usageEvents: checks.usageEvents,
        ledgerEntries: checks.ledgerEntries,
      },
      after: {
        usageEvents: usageCountAfterDenied,
        ledgerEntries: ledgerCountAfterDenied,
      },
      denied: denied.body,
    });
  }

  return {
    dependencyStatus: dependencyHealth.status,
    deniedRouteCode: denied.body?.error?.code,
    usageEventId: chat.billing.usage_event_id,
    ...checks,
  };
}

async function smokeConsole() {
  const paths = [
    "/overview",
    "/apps",
    "/channels",
    "/faucet",
    "/routes",
    "/pricing",
    "/credentials",
    "/usage-ledger",
  ];
  const pages = [];

  if (!consoleOperatorToken) {
    fail("Console smoke operator token is not configured.");
  }

  const anonymousResponse = await fetch(`${consoleBaseUrl}/setup`, {
    redirect: "manual",
  });
  const anonymousLocation = anonymousResponse.headers.get("location");
  const anonymousLoginUrl = anonymousLocation
    ? new URL(anonymousLocation, consoleBaseUrl)
    : undefined;

  if (
    ![302, 303, 307, 308].includes(anonymousResponse.status) ||
    anonymousLoginUrl?.pathname !== "/login"
  ) {
    fail("Console did not reject an anonymous protected request.", {
      location: anonymousLocation,
      status: anonymousResponse.status,
    });
  }

  for (const path of paths) {
    const response = await fetch(`${consoleBaseUrl}${path}`, {
      headers: {
        authorization: `Bearer ${consoleOperatorToken}`,
      },
    });
    const text = await response.text();

    const hasGatewaySource = gatewaySourceSignals.some((signal) =>
      text.includes(signal),
    );

    if (!response.ok || !hasGatewaySource) {
      fail("Console page did not render Gateway-backed data.", {
        path,
        status: response.status,
      });
    }

    if (
      text.includes("encrypted_api_key") ||
      text.includes(adminToken) ||
      text.includes(consoleOperatorToken) ||
      text.includes("fl_sess_")
    ) {
      fail("Console page exposed a secret-like value.", { path });
    }

    pages.push(path);
  }

  return pages;
}

const gateway = await smokeGateway();
const consolePages = checkConsole ? await smokeConsole() : [];

console.log(
  JSON.stringify(
    {
      ok: true,
      gatewayBaseUrl,
      consoleBaseUrl: checkConsole ? consoleBaseUrl : undefined,
      gateway,
      consolePages,
    },
    null,
    2,
  ),
);
