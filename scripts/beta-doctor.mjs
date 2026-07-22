import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import console from "node:console";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const defaultEnvFile = ".env.production";
const minimumNodeVersion = "20.11.0";
const placeholderPattern = /(?:change_me|local-placeholder|replace_with)/i;
const requiredKeys = [
  "CONSOLE_GATEWAY_ADMIN_TOKEN",
  "CONSOLE_OPERATOR_TOKEN_SHA256",
  "CONSOLE_SESSION_COOKIE_SECURE",
  "CONSOLE_SESSION_SECRET",
  "DATABASE_URL",
  "FOUNTLAYER_ADMIN_TOKEN_SHA256",
  "FOUNTLAYER_CREDENTIAL_KEY_VERSION",
  "FOUNTLAYER_CREDENTIAL_MASTER_KEY",
  "FOUNTLAYER_IMAGE_TAG",
  "FOUNTLAYER_SESSION_TICKET_SECRET",
  "FOUNTLAYER_VCS_REF",
  "LITELLM_MASTER_KEY",
  "NEXT_PUBLIC_GATEWAY_BASE_URL",
  "POSTGRES_DB",
  "POSTGRES_PASSWORD",
  "POSTGRES_USER",
  "UPSTREAM_OPENAI_API_KEY",
  "UPSTREAM_OPENAI_BASE_URL",
  "UPSTREAM_OPENAI_MODEL",
];
const independentSecretKeys = [
  "CONSOLE_GATEWAY_ADMIN_TOKEN",
  "CONSOLE_SESSION_SECRET",
  "FOUNTLAYER_SESSION_TICKET_SECRET",
  "LITELLM_MASTER_KEY",
  "POSTGRES_PASSWORD",
  "UPSTREAM_OPENAI_API_KEY",
];

function check(id, status, message, remediation) {
  return {
    id,
    message,
    ...(remediation ? { remediation } : {}),
    status,
  };
}

function compareVersions(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);

  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);

    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

function configured(value) {
  return Boolean(value?.trim()) && !placeholderPattern.test(value);
}

function isSha256(value) {
  return /^[a-f0-9]{64}$/.test(value ?? "");
}

function isCommitSha(value) {
  return /^[a-f0-9]{40}$/.test(value ?? "");
}

function isStrong(value, minimumLength = 32) {
  return configured(value) && value.length >= minimumLength;
}

function isValidCredentialMasterKey(value) {
  if (!configured(value) || !value.startsWith("base64:")) {
    return false;
  }

  const encoded = value.slice("base64:".length);

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    return false;
  }

  return Buffer.from(encoded, "base64").length === 32;
}

function isHttpsUrl(value) {
  if (!configured(value)) {
    return false;
  }

  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isComposeDatabaseUrl(value) {
  if (!configured(value)) {
    return false;
  }

  try {
    const parsed = new URL(value);

    return (
      ["postgres:", "postgresql:"].includes(parsed.protocol) &&
      Boolean(parsed.username) &&
      Boolean(parsed.password) &&
      !["127.0.0.1", "localhost"].includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}

function parseQuotedValue(rawValue, lineNumber) {
  const quote = rawValue[0];
  const closingIndex = rawValue.lastIndexOf(quote);

  const trailing = rawValue.slice(closingIndex + 1).trim();

  if (closingIndex === 0 || (trailing && !trailing.startsWith("#"))) {
    throw new Error(`Invalid quoted environment value at line ${lineNumber}.`);
  }

  const value = rawValue.slice(1, closingIndex);

  if (quote === "'") {
    return value;
  }

  return value.replace(/\\([\\nrt"])/g, (_match, escaped) => {
    return { "\\": "\\", n: "\n", r: "\r", t: "\t", '"': '"' }[escaped];
  });
}

export function parseEnvFileText(text) {
  const env = {};

  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = line.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/,
    );

    if (!match) {
      throw new Error(`Invalid environment assignment at line ${index + 1}.`);
    }

    const [, key, rawValue = ""] = match;
    const value = rawValue.trim();

    env[key] =
      value.startsWith("'") || value.startsWith('"')
        ? parseQuotedValue(value, index + 1)
        : value.replace(/\s+#.*$/, "").trim();
  }

  return env;
}

export function inspectBetaDoctor(facts) {
  const checks = [];
  const nodeVersion = facts.nodeVersion.replace(/^v/, "");
  const finish = () => {
    const summary = checks.reduce(
      (counts, item) => ({
        ...counts,
        [item.status]: counts[item.status] + 1,
      }),
      { fail: 0, pass: 0, warn: 0 },
    );

    return {
      checks,
      envFile: facts.envFile,
      ok: summary.fail === 0,
      profile: "self-hosted-managed-beta",
      summary,
    };
  };

  checks.push(
    compareVersions(nodeVersion, minimumNodeVersion) >= 0
      ? check(
          "toolchain.node",
          "pass",
          `Node.js satisfies the minimum ${minimumNodeVersion} runtime.`,
        )
      : check(
          "toolchain.node",
          "fail",
          `Node.js ${minimumNodeVersion} or newer is required.`,
          "Install a supported Node.js release and rerun the doctor.",
        ),
  );

  checks.push(
    facts.installedPnpmVersion === facts.requiredPnpmVersion
      ? check(
          "toolchain.pnpm",
          "pass",
          "The active pnpm version matches packageManager.",
        )
      : check(
          "toolchain.pnpm",
          "fail",
          "The active pnpm version does not match packageManager.",
          `Run corepack prepare pnpm@${facts.requiredPnpmVersion} --activate.`,
        ),
  );

  checks.push(
    facts.dockerAvailable
      ? check("toolchain.docker", "pass", "Docker CLI is available.")
      : check(
          "toolchain.docker",
          "fail",
          "Docker CLI is unavailable.",
          "Install Docker with Compose support before using the self-hosted beta path.",
        ),
  );

  checks.push(
    facts.composeAvailable
      ? check("toolchain.compose", "pass", "Docker Compose is available.")
      : check(
          "toolchain.compose",
          "fail",
          "Docker Compose is unavailable.",
          "Enable the Docker Compose plugin and rerun the doctor.",
        ),
  );

  if (!facts.envFileExists) {
    checks.push(
      check(
        "config.env-file",
        "fail",
        "The production environment file is missing.",
        "Copy infra/production.env.example to the selected private env file and replace every placeholder.",
      ),
    );
  } else if (facts.envFileError) {
    checks.push(
      check(
        "config.env-file",
        "fail",
        "The production environment file could not be parsed.",
        "Use standard KEY=value assignments and rerun the doctor.",
      ),
    );
  } else {
    checks.push(
      check(
        "config.env-file",
        "pass",
        "The production environment file is readable and parseable.",
      ),
    );
  }

  if (!facts.envFileExists || facts.envFileError) {
    checks.push(
      check(
        "config.file-permissions",
        "warn",
        "File permissions were not evaluated because the environment file is unavailable.",
        "Create a parseable private env file, then rerun the doctor.",
      ),
      check(
        "config.compose",
        "warn",
        "Compose expansion was skipped because the environment file is unavailable.",
        "Create the selected env file, then rerun the doctor.",
      ),
    );

    return finish();
  }

  checks.push(
    facts.envFilePrivate
      ? check(
          "config.file-permissions",
          "pass",
          "The production environment file is private to its owner.",
        )
      : check(
          "config.file-permissions",
          "fail",
          "The production environment file is accessible beyond its owner.",
          "Run chmod 600 on the selected env file.",
        ),
  );

  const missingKeys = requiredKeys.filter((key) => !configured(facts.env[key]));

  checks.push(
    missingKeys.length === 0
      ? check(
          "config.required-values",
          "pass",
          "Every required beta configuration value is present and non-placeholder.",
        )
      : check(
          "config.required-values",
          "fail",
          `Missing or placeholder variables: ${missingKeys.join(", ")}.`,
          "Replace every named value in the private env file.",
        ),
  );

  const hashesAreValid = [
    facts.env.FOUNTLAYER_ADMIN_TOKEN_SHA256,
    facts.env.CONSOLE_OPERATOR_TOKEN_SHA256,
  ].every(isSha256);

  checks.push(
    hashesAreValid
      ? check(
          "config.token-hashes",
          "pass",
          "Gateway and Console token digests use lowercase SHA-256 hex.",
        )
      : check(
          "config.token-hashes",
          "fail",
          "Gateway and Console token digests must use lowercase SHA-256 hex.",
          "Regenerate both token digests from their independent plaintext tokens.",
        ),
  );

  const expectedAdminHash = configured(facts.env.CONSOLE_GATEWAY_ADMIN_TOKEN)
    ? createHash("sha256")
        .update(facts.env.CONSOLE_GATEWAY_ADMIN_TOKEN)
        .digest("hex")
    : undefined;

  checks.push(
    expectedAdminHash &&
      expectedAdminHash === facts.env.FOUNTLAYER_ADMIN_TOKEN_SHA256
      ? check(
          "config.admin-token-pair",
          "pass",
          "The Console Gateway token matches the Gateway token digest.",
        )
      : check(
          "config.admin-token-pair",
          "fail",
          "The Console Gateway token does not match the Gateway token digest.",
          "Hash CONSOLE_GATEWAY_ADMIN_TOKEN with SHA-256 and store only the digest in FOUNTLAYER_ADMIN_TOKEN_SHA256.",
        ),
  );

  checks.push(
    isValidCredentialMasterKey(facts.env.FOUNTLAYER_CREDENTIAL_MASTER_KEY)
      ? check(
          "config.credential-master-key",
          "pass",
          "The credential master key decodes to exactly 32 bytes.",
        )
      : check(
          "config.credential-master-key",
          "fail",
          "The credential master key must be base64-encoded 32-byte material.",
          "Generate an independent 32-byte key and prefix its base64 form with base64:.",
        ),
  );

  const strengthRequirements = [
    ["CONSOLE_GATEWAY_ADMIN_TOKEN", 32],
    ["CONSOLE_SESSION_SECRET", 32],
    ["FOUNTLAYER_SESSION_TICKET_SECRET", 32],
    ["LITELLM_MASTER_KEY", 32],
    ["POSTGRES_PASSWORD", 16],
  ];
  const weakKeys = strengthRequirements
    .filter(([key, length]) => !isStrong(facts.env[key], length))
    .map(([key]) => key);

  checks.push(
    weakKeys.length === 0
      ? check(
          "config.secret-strength",
          "pass",
          "Operator-controlled secrets meet the beta minimum lengths.",
        )
      : check(
          "config.secret-strength",
          "fail",
          `Weak or placeholder secrets: ${weakKeys.join(", ")}.`,
          "Generate independent high-entropy values for every named secret.",
        ),
  );

  const secretValues = independentSecretKeys
    .map((key) => facts.env[key])
    .filter(configured);

  checks.push(
    secretValues.length === independentSecretKeys.length &&
      new Set(secretValues).size === secretValues.length
      ? check(
          "config.secret-uniqueness",
          "pass",
          "Security domains use independent plaintext secrets.",
        )
      : check(
          "config.secret-uniqueness",
          "fail",
          "One or more security domains reuse or omit a plaintext secret.",
          "Generate a different value for each database, admin, ticket, Console, LiteLLM, and provider secret.",
        ),
  );

  checks.push(
    isHttpsUrl(facts.env.UPSTREAM_OPENAI_BASE_URL) &&
      isHttpsUrl(facts.env.NEXT_PUBLIC_GATEWAY_BASE_URL)
      ? check(
          "config.https-origins",
          "pass",
          "The upstream and public Gateway origins use HTTPS.",
        )
      : check(
          "config.https-origins",
          "fail",
          "The upstream and public Gateway origins must use HTTPS.",
          "Configure TLS origins before exposing the beta remotely.",
        ),
  );

  checks.push(
    isComposeDatabaseUrl(facts.env.DATABASE_URL)
      ? check(
          "config.database-url",
          "pass",
          "DATABASE_URL targets an authenticated non-loopback PostgreSQL service.",
        )
      : check(
          "config.database-url",
          "fail",
          "DATABASE_URL must target an authenticated non-loopback PostgreSQL service.",
          "Use the production Compose service hostname and a URL-encoded password.",
        ),
  );

  checks.push(
    facts.env.CONSOLE_SESSION_COOKIE_SECURE === "true"
      ? check(
          "config.secure-cookie",
          "pass",
          "Console secure cookies are enabled.",
        )
      : check(
          "config.secure-cookie",
          "fail",
          "Console secure cookies must be enabled for the production beta.",
          "Set CONSOLE_SESSION_COOKIE_SECURE=true.",
        ),
  );

  checks.push(
    facts.env.FOUNTLAYER_IMAGE_TAG === facts.packageVersion &&
      isCommitSha(facts.env.FOUNTLAYER_VCS_REF) &&
      facts.env.FOUNTLAYER_VCS_REF === facts.currentCommit
      ? check(
          "config.release-identity",
          "pass",
          "Image version and VCS reference match the current candidate.",
        )
      : check(
          "config.release-identity",
          "fail",
          "Image version or VCS reference does not match the current candidate.",
          "Set FOUNTLAYER_IMAGE_TAG to the package version and FOUNTLAYER_VCS_REF to the full current commit SHA.",
        ),
  );

  checks.push(
    facts.composeConfigValid === true
      ? check(
          "config.compose",
          "pass",
          "Production Compose accepts the selected environment file.",
        )
      : facts.composeConfigValid === false
        ? check(
            "config.compose",
            "fail",
            "Production Compose rejected the selected environment file.",
            "Correct the named configuration checks, then rerun the doctor.",
          )
        : check(
            "config.compose",
            "warn",
            "Compose expansion was skipped because Docker Compose is unavailable.",
            "Install Docker Compose, then rerun the doctor.",
          ),
  );

  return finish();
}

export function formatDoctorReport(report) {
  const lines = [
    "FountLayer beta doctor",
    `Profile: ${report.profile}`,
    `Environment file: ${report.envFile}`,
    "",
  ];

  for (const item of report.checks) {
    lines.push(`${item.status.toUpperCase()} ${item.id} - ${item.message}`);

    if (item.remediation && item.status !== "pass") {
      lines.push(`  Remediation: ${item.remediation}`);
    }
  }

  lines.push(
    "",
    `Summary: ${report.summary.pass} pass, ${report.summary.warn} warn, ${report.summary.fail} fail`,
  );

  return lines.join("\n");
}

function parseArgs(args) {
  const options = { envFile: defaultEnvFile, json: false };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--json") {
      options.json = true;
      continue;
    }

    if (argument === "--env-file") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("--env-file requires a path.");
      }

      options.envFile = value;
      index += 1;
      continue;
    }

    if (argument === "--help") {
      options.help = true;
      continue;
    }

    throw new Error(`Unknown option: ${argument}`);
  }

  return options;
}

function command(commandName, args, cwd) {
  const result = spawnSync(commandName, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 10_000,
  });

  return {
    ok: !result.error && result.status === 0,
    stdout: result.stdout?.trim() ?? "",
  };
}

async function loadFacts(root, envFile) {
  const manifest = JSON.parse(
    await readFile(resolve(root, "package.json"), "utf8"),
  );
  const requiredPnpmVersion = manifest.packageManager?.split("@").at(-1) ?? "";
  const installedPnpm = command("pnpm", ["--version"], root);
  const docker = command("docker", ["--version"], root);
  const compose = command("docker", ["compose", "version"], root);
  const git = command("git", ["rev-parse", "HEAD"], root);
  const envFilePath = resolve(root, envFile);
  let envFileExists = false;
  let envFilePrivate = false;
  let envFileError = false;
  let parsedEnv = {};

  try {
    const fileStat = await stat(envFilePath);

    envFileExists = fileStat.isFile();
    envFilePrivate = (fileStat.mode & 0o077) === 0;

    if (envFileExists) {
      try {
        parsedEnv = parseEnvFileText(await readFile(envFilePath, "utf8"));
      } catch {
        envFileError = true;
      }
    }
  } catch {
    envFileExists = false;
  }

  const composeConfig =
    compose.ok && envFileExists
      ? command(
          "docker",
          [
            "compose",
            "--env-file",
            envFilePath,
            "-f",
            "compose.production.yml",
            "config",
            "--quiet",
          ],
          root,
        ).ok
      : undefined;

  return {
    composeAvailable: compose.ok,
    composeConfigValid: composeConfig,
    currentCommit: git.stdout,
    dockerAvailable: docker.ok,
    env: parsedEnv,
    envFile,
    envFileError,
    envFileExists,
    envFilePrivate,
    installedPnpmVersion: installedPnpm.stdout,
    nodeVersion: process.version,
    packageVersion: manifest.version,
    requiredPnpmVersion,
  };
}

async function main() {
  let options;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Invalid arguments.",
    );
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    console.log(
      "Usage: pnpm beta:doctor [--env-file <path>] [--json]\n\nValidates the production-shaped self-hosted Managed beta configuration without printing secret values.",
    );
    return;
  }

  const root = process.cwd();
  const report = inspectBetaDoctor(await loadFacts(root, options.envFile));

  console.log(
    options.json ? JSON.stringify(report, null, 2) : formatDoctorReport(report),
  );
  process.exitCode = report.ok ? 0 : 1;
}

const isDirectRun =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  await main();
}
