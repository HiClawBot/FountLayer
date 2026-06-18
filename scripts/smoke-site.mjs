/* global console, process */

import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const siteDistDir = join(process.cwd(), "apps/site/dist");
const projectUrl = "https://hiclawbot.github.io/FountLayer/";

const checks = [];

function pass(label) {
  checks.push({ label, ok: true });
}

function fail(label, detail) {
  checks.push({ label, ok: false, detail });
}

async function fileText(path) {
  if (!existsSync(path)) {
    fail(path, "missing file");
    return "";
  }

  return readFile(path, "utf8");
}

const indexPath = join(siteDistDir, "index.html");
const robotsPath = join(siteDistDir, "robots.txt");
const sitemapPath = join(siteDistDir, "sitemap.xml");
const ogImagePath = join(siteDistDir, "og-image.svg");

const indexHtml = await fileText(indexPath);
const robots = await fileText(robotsPath);
const sitemap = await fileText(sitemapPath);
const ogImage = await fileText(ogImagePath);

if (indexHtml.includes("FountLayer | Open LLM Last-Mile Distribution")) {
  pass("index title");
} else {
  fail("index title", "expected FountLayer title");
}

for (const { label, pattern } of [
  {
    label: "meta description",
    pattern: /<meta\s+name="description"\s+content="[^"]+"\s*\/>/s,
  },
  {
    label: "robots meta",
    pattern: /<meta\s+name="robots"\s+content="index, follow"\s*\/>/s,
  },
  {
    label: "canonical link",
    pattern: new RegExp(
      `<link\\s+rel="canonical"\\s+href="${projectUrl}"\\s*/>`,
      "s",
    ),
  },
  {
    label: "OG title",
    pattern:
      /<meta\s+property="og:title"\s+content="FountLayer \| Open LLM Last-Mile Distribution"\s*\/>/s,
  },
  {
    label: "OG URL",
    pattern: new RegExp(
      `<meta\\s+property="og:url"\\s+content="${projectUrl}"\\s*/>`,
      "s",
    ),
  },
  {
    label: "OG image",
    pattern: new RegExp(
      `<meta\\s+property="og:image"\\s+content="${projectUrl}og-image.svg"\\s*/>`,
      "s",
    ),
  },
  {
    label: "Twitter card",
    pattern:
      /<meta\s+name="twitter:card"\s+content="summary_large_image"\s*\/>/s,
  },
]) {
  if (pattern.test(indexHtml)) {
    pass(`index ${label}`);
  } else {
    fail(`index ${label}`, "missing SEO/social metadata");
  }
}

if (indexHtml.includes("/FountLayer/assets/")) {
  pass("project Pages asset base path");
} else {
  fail(
    "project Pages asset base path",
    "expected /FountLayer/assets/ in build output",
  );
}

if (!indexHtml.includes("/src/main.tsx")) {
  pass("production entrypoint");
} else {
  fail("production entrypoint", "source entrypoint leaked into built HTML");
}

if (robots.includes(`Sitemap: ${projectUrl}sitemap.xml`)) {
  pass("robots sitemap");
} else {
  fail("robots sitemap", "robots.txt does not point at sitemap");
}

if (sitemap.includes(`<loc>${projectUrl}</loc>`)) {
  pass("sitemap canonical URL");
} else {
  fail("sitemap canonical URL", "sitemap is missing project Pages URL");
}

if (
  existsSync(ogImagePath) &&
  statSync(ogImagePath).size > 1_000 &&
  ogImage.includes("<svg")
) {
  pass("OG image asset");
} else {
  fail("OG image asset", "og-image.svg is missing or unexpectedly small");
}

const failed = checks.filter((check) => !check.ok);

if (failed.length > 0) {
  for (const check of failed) {
    console.error(`FAIL ${check.label}: ${check.detail}`);
  }
  process.exit(1);
}

for (const check of checks) {
  console.log(`PASS ${check.label}`);
}
