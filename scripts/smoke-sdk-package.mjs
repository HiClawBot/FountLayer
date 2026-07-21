/* global console, process */

import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspace = await mkdtemp(join(tmpdir(), "fountlayer-sdk-consumer-"));

async function run(command, args, cwd = root) {
  return execFileAsync(command, args, {
    cwd,
    env: process.env,
    maxBuffer: 8 * 1024 * 1024,
  });
}

try {
  await run("pnpm", ["--filter", "@fountlayer/sdk-js...", "build"]);

  for (const packageName of [
    "@fountlayer/protocol",
    "@fountlayer/session-ticket",
    "@fountlayer/sdk-js",
  ]) {
    await run("pnpm", [
      "--filter",
      packageName,
      "pack",
      "--pack-destination",
      workspace,
    ]);
  }

  const tarballs = (await readdir(workspace))
    .filter((name) => name.endsWith(".tgz"))
    .sort();

  if (tarballs.length !== 3) {
    throw new Error(`Expected 3 package tarballs, found ${tarballs.length}.`);
  }

  const packageByFragment = (fragment) => {
    const name = tarballs.find((candidate) => candidate.includes(fragment));

    if (!name) {
      throw new Error(`Missing ${fragment} package tarball.`);
    }

    return `file:${join(workspace, name)}`;
  };

  await writeFile(
    join(workspace, "package.json"),
    JSON.stringify(
      {
        name: "fountlayer-sdk-consumer-smoke",
        private: true,
        type: "module",
        dependencies: {
          "@fountlayer/protocol": packageByFragment("protocol"),
          "@fountlayer/sdk-js": packageByFragment("sdk-js"),
          "@fountlayer/session-ticket": packageByFragment("session-ticket"),
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  await run(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
    workspace,
  );
  const { stdout } = await run(
    "node",
    [
      "--input-type=module",
      "--eval",
      [
        "import { createFountLayer, FountLayerClient } from '@fountlayer/sdk-js';",
        "const client = createFountLayer({ appId: 'app_test', channelId: 'channel_test', endpoint: 'https://gateway.example.invalid' });",
        "if (!(client instanceof FountLayerClient) || typeof client.startSession !== 'function') process.exit(1);",
        "process.stdout.write('sdk-consumer-import-ok');",
      ].join("\n"),
    ],
    workspace,
  );

  console.log(
    JSON.stringify(
      {
        importResult: stdout.trim(),
        ok: true,
        tarballs,
      },
      null,
      2,
    ),
  );
} finally {
  await rm(workspace, { force: true, recursive: true });
}
