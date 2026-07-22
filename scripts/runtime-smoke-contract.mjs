import { formatMoney, parseMoney } from "@fountlayer/money";
import { URL } from "node:url";

const placeholderPattern = /(?:change_me|local-placeholder|replace_with)/i;

function issue(id, message, remediation) {
  return { id, message, remediation };
}

export function inspectRuntimeSmokeArguments(arguments_) {
  const unknownArguments = arguments_.filter(
    (argument) => argument !== "--staging",
  );

  return {
    issues:
      unknownArguments.length === 0
        ? []
        : [
            issue(
              "runtime.arguments",
              "The runtime smoke command received an unsupported option.",
              "Run without options or use only --staging.",
            ),
          ],
    ok: unknownArguments.length === 0,
    stagingProfile: arguments_.includes("--staging"),
  };
}

function isRemoteHttpsUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");

    return (
      parsed.protocol === "https:" &&
      !["localhost", "127.0.0.1", "::1"].includes(hostname)
    );
  } catch {
    return false;
  }
}

function isStrongSecret(value) {
  return (
    typeof value === "string" &&
    value.length >= 32 &&
    !placeholderPattern.test(value)
  );
}

export function inspectStagingSmokeConfiguration(input) {
  const issues = [];

  if (!isRemoteHttpsUrl(input.gatewayBaseUrl)) {
    issues.push(
      issue(
        "staging.gateway-url",
        "GATEWAY_BASE_URL must be an explicit non-loopback HTTPS origin.",
        "Set GATEWAY_BASE_URL to the TLS staging Gateway origin.",
      ),
    );
  }

  if (!isStrongSecret(input.adminToken)) {
    issues.push(
      issue(
        "staging.admin-token",
        "A non-placeholder Gateway Admin token of at least 32 characters is required.",
        "Set CONSOLE_GATEWAY_ADMIN_TOKEN to the staging Gateway Admin plaintext token.",
      ),
    );
  }

  if (!isStrongSecret(input.sessionTicketSecret)) {
    issues.push(
      issue(
        "staging.ticket-secret",
        "A non-placeholder session-ticket secret of at least 32 characters is required.",
        "Set FOUNTLAYER_SESSION_TICKET_SECRET to the staging trusted-backend secret.",
      ),
    );
  }

  if (!input.checkConsole) {
    issues.push(
      issue(
        "staging.console-check",
        "Credentialed staging smoke requires Console verification.",
        "Remove FOUNTLAYER_SMOKE_CHECK_CONSOLE=0 for the golden-path run.",
      ),
    );
  } else {
    if (!isRemoteHttpsUrl(input.consoleBaseUrl)) {
      issues.push(
        issue(
          "staging.console-url",
          "CONSOLE_BASE_URL must be an explicit non-loopback HTTPS origin.",
          "Set CONSOLE_BASE_URL to the TLS staging Console origin.",
        ),
      );
    }

    if (!isStrongSecret(input.consoleOperatorToken)) {
      issues.push(
        issue(
          "staging.console-token",
          "A non-placeholder Console operator token of at least 32 characters is required.",
          "Set CONSOLE_SMOKE_OPERATOR_TOKEN to the staging Console operator token.",
        ),
      );
    }
  }

  return {
    issues,
    ok: issues.length === 0,
    profile: "credentialed-staging",
  };
}

function requiredMoney(value, label) {
  try {
    return parseMoney(value);
  } catch {
    throw new Error(`${label} must be a non-negative fixed-point money value.`);
  }
}

function sumDirection(entries, direction) {
  return entries
    .filter((entry) => entry.direction === direction)
    .reduce(
      (total, entry) =>
        total + requiredMoney(entry.amount, `${direction} ledger amount`),
      0n,
    );
}

function hasEntry(entries, direction, reason, amount) {
  return entries.some(
    (entry) =>
      entry.direction === direction &&
      entry.reason === reason &&
      requiredMoney(entry.amount, `${reason} ledger amount`) === amount,
  );
}

export function reconcileSmokeBilling({ billing, ledgerEntries, usageEvents }) {
  const usageEventId = billing?.usage_event_id;
  const expectedLedgerEntryCount = billing?.ledger_entry_count;

  if (typeof usageEventId !== "string" || !usageEventId) {
    throw new Error("Chat billing did not include a usage event ID.");
  }

  if (expectedLedgerEntryCount !== 4) {
    throw new Error(
      "Managed beta billing must report exactly four ledger entries.",
    );
  }

  const matchingUsageEvents = usageEvents.filter(
    (event) => event.id === usageEventId,
  );

  if (matchingUsageEvents.length !== 1) {
    throw new Error(
      "Admin readback must return exactly one matching usage event.",
    );
  }

  const usageEvent = matchingUsageEvents[0];

  if (usageEvent.status !== "success") {
    throw new Error("The matching usage event is not successful.");
  }

  if (usageEvent.usageEstimated !== false) {
    throw new Error(
      "The matching usage event must use provider-supplied usage.",
    );
  }

  if (
    typeof usageEvent.provider !== "string" ||
    usageEvent.provider.length === 0
  ) {
    throw new Error("The matching usage event must identify its provider.");
  }

  const tokenCounts = [usageEvent.inputTokens, usageEvent.outputTokens];

  if (
    tokenCounts.some((value) => !Number.isSafeInteger(value) || value < 0) ||
    tokenCounts.every((value) => value === 0)
  ) {
    throw new Error("The matching usage event has invalid token counts.");
  }

  const upstreamCost = requiredMoney(
    usageEvent.upstreamCost,
    "Usage-event upstream cost",
  );
  const retailPrice = requiredMoney(
    usageEvent.retailPrice,
    "Usage-event retail price",
  );
  const billedUpstreamCost = requiredMoney(
    billing.upstream_cost,
    "Chat billing upstream cost",
  );
  const billedRetailPrice = requiredMoney(
    billing.retail_price,
    "Chat billing retail price",
  );

  if (upstreamCost === 0n || retailPrice === 0n) {
    throw new Error(
      "Golden-path upstream cost and retail price must be positive.",
    );
  }

  if (
    upstreamCost !== billedUpstreamCost ||
    retailPrice !== billedRetailPrice
  ) {
    throw new Error("Chat billing and usage-event money do not match.");
  }

  const matchingLedgerEntries = ledgerEntries.filter(
    (entry) => entry.usageEventId === usageEventId,
  );

  if (matchingLedgerEntries.length !== expectedLedgerEntryCount) {
    throw new Error(
      "Ledger readback did not return the expected exact entry set.",
    );
  }

  const debits = sumDirection(matchingLedgerEntries, "debit");
  const credits = sumDirection(matchingLedgerEntries, "credit");

  if (debits !== credits) {
    throw new Error("Usage-event ledger debits and credits are not balanced.");
  }

  const expectedEntries = [
    ["debit", "retail_charge", retailPrice],
    ["credit", "platform_revenue", retailPrice],
    ["debit", "provider_cost", upstreamCost],
    ["credit", "provider_payable", upstreamCost],
  ];

  if (
    expectedEntries.some(
      ([direction, reason, amount]) =>
        !hasEntry(matchingLedgerEntries, direction, reason, amount),
    )
  ) {
    throw new Error("Usage-event ledger reasons or amounts do not reconcile.");
  }

  return {
    credits: formatMoney(credits),
    debits: formatMoney(debits),
    inputTokens: usageEvent.inputTokens,
    ledgerEntries: matchingLedgerEntries.length,
    outputTokens: usageEvent.outputTokens,
    provider: usageEvent.provider,
    retailPrice: formatMoney(retailPrice),
    upstreamCost: formatMoney(upstreamCost),
    usageEstimated: usageEvent.usageEstimated,
    usageEventId,
  };
}
