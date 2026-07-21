import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@fountlayer/adapter-core": new URL(
        "./packages/adapter-core/src/index.ts",
        import.meta.url,
      ).pathname,
      "@fountlayer/adapter-litellm": new URL(
        "./packages/adapter-litellm/src/index.ts",
        import.meta.url,
      ).pathname,
      "@fountlayer/adapter-local": new URL(
        "./packages/adapter-local/src/index.ts",
        import.meta.url,
      ).pathname,
      "@fountlayer/db": new URL("./packages/db/src/index.ts", import.meta.url)
        .pathname,
      "@fountlayer/credentials": new URL(
        "./packages/credentials/src/index.ts",
        import.meta.url,
      ).pathname,
      "@fountlayer/faucet": new URL(
        "./packages/faucet/src/index.ts",
        import.meta.url,
      ).pathname,
      "@fountlayer/ledger": new URL(
        "./packages/ledger/src/index.ts",
        import.meta.url,
      ).pathname,
      "@fountlayer/observability": new URL(
        "./packages/observability/src/index.ts",
        import.meta.url,
      ).pathname,
      "@fountlayer/pricing": new URL(
        "./packages/pricing/src/index.ts",
        import.meta.url,
      ).pathname,
      "@fountlayer/privacy": new URL(
        "./packages/privacy/src/index.ts",
        import.meta.url,
      ).pathname,
      "@fountlayer/protocol": new URL(
        "./packages/protocol/src/index.ts",
        import.meta.url,
      ).pathname,
      "@fountlayer/reliability": new URL(
        "./packages/reliability/src/index.ts",
        import.meta.url,
      ).pathname,
      "@fountlayer/sdk-js": new URL(
        "./packages/sdk-js/src/index.ts",
        import.meta.url,
      ).pathname,
      "@fountlayer/session-ticket": new URL(
        "./packages/session-ticket/src/index.ts",
        import.meta.url,
      ).pathname,
      "@fountlayer/settlement": new URL(
        "./packages/settlement/src/index.ts",
        import.meta.url,
      ).pathname,
    },
  },
  test: {
    include: ["apps/**/*.test.ts", "packages/**/*.test.ts"],
    passWithNoTests: true,
  },
});
