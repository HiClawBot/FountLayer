/* global console, process */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

async function text(path) {
  return readFile(join(root, path), "utf8").catch(() => undefined);
}

function fail(path, detail) {
  failures.push({ path, detail });
}

const rootManifestText = await text("package.json");

if (rootManifestText === undefined) {
  fail("package.json", "missing root manifest");
}

const rootManifest = rootManifestText
  ? JSON.parse(rootManifestText)
  : { version: undefined };
const expectedVersion = rootManifest.version;

if (!/^\d+\.\d+\.\d+-beta\.\d+$/.test(expectedVersion ?? "")) {
  fail("package.json", `invalid beta version: ${expectedVersion ?? "missing"}`);
}

for (const directory of ["apps", "packages"]) {
  for (const entry of await readdir(join(root, directory), {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const path = join(directory, entry.name, "package.json");
    const manifestText = await text(path);

    if (manifestText === undefined) {
      continue;
    }

    const manifest = JSON.parse(manifestText);

    if (manifest.version !== expectedVersion) {
      fail(
        path,
        `expected ${expectedVersion}, found ${manifest.version ?? "missing"}`,
      );
    }
  }
}

const requiredMarkers = [
  ["Dockerfile", `ARG VERSION=${expectedVersion}`],
  ["compose.production.yml", `FOUNTLAYER_IMAGE_TAG:-${expectedVersion}`],
  ["infra/production.env.example", `FOUNTLAYER_IMAGE_TAG=${expectedVersion}`],
  ["docs/openapi.yaml", `version: ${expectedVersion}`],
  ["docs/BETA_CAPABILITIES.md", `Target: \`v${expectedVersion}\``],
  ["docs/RELEASE_CHECKLIST.md", `## v${expectedVersion} Gates`],
  [".github/workflows/container-gates.yml", `VERSION="${expectedVersion}"`],
  ["README.md", `GITHUB_RELEASE_v${expectedVersion}.md`],
  ["README.md", `RELEASE_NOTES_v${expectedVersion}.md`],
  [
    `docs/GITHUB_RELEASE_v${expectedVersion}.md`,
    `Tag: \`v${expectedVersion}\``,
  ],
  [
    `docs/RELEASE_NOTES_v${expectedVersion}.md`,
    `# FountLayer v${expectedVersion} Release Notes`,
  ],
];

for (const [path, marker] of requiredMarkers) {
  const fileText = await text(path);

  if (fileText === undefined) {
    fail(path, "missing release surface");
  } else if (!fileText.includes(marker)) {
    fail(path, `missing marker: ${marker}`);
  }
}

const forbiddenMarkers = [
  ["apps/site/src/App.tsx", 'mode: "developer_key"'],
  ["apps/site/src/App.tsx", 'value: "132 passed"'],
  ["apps/site/src/App.tsx", 'value: "132 项通过"'],
];

for (const [path, marker] of forbiddenMarkers) {
  const fileText = await text(path);

  if (fileText?.includes(marker)) {
    fail(path, `unsupported or stale public claim: ${marker}`);
  }
}

if (failures.length > 0) {
  console.error(
    JSON.stringify({ expectedVersion, failures, ok: false }, null, 2),
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      expectedVersion,
      ok: true,
      verifiedAbsences: forbiddenMarkers.length,
      verifiedMarkers: requiredMarkers.length,
    },
    null,
    2,
  ),
);
