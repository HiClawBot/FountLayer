/* global console, process */

import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const outputPath = resolve(
  process.argv[2] ?? "artifacts/third-party-licenses.json",
);
const { stdout } = await execFileAsync(
  "pnpm",
  ["licenses", "list", "--prod", "--json"],
  { maxBuffer: 16 * 1024 * 1024 },
);
const grouped = JSON.parse(stdout);
const packages = Object.entries(grouped)
  .flatMap(([license, records]) =>
    records.map((record) => ({
      author: record.author,
      description: record.description,
      homepage: record.homepage,
      license,
      name: record.name,
      versions: record.versions,
    })),
  )
  .sort((left, right) =>
    `${left.name}:${left.versions.join(",")}`.localeCompare(
      `${right.name}:${right.versions.join(",")}`,
    ),
  );

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify({ packages, schemaVersion: 1 }, null, 2)}\n`,
  "utf8",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      outputPath,
      packages: packages.length,
    },
    null,
    2,
  ),
);
