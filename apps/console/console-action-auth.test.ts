import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
  }),
  headers: async () => new Headers(),
}));

import { createConsoleApp } from "./lib/gateway-admin";

afterEach(() => {
  delete process.env.CONSOLE_OPERATOR_TOKEN_SHA256;
  delete process.env.CONSOLE_SESSION_SECRET;
  vi.unstubAllGlobals();
});

describe("Console Server Action authorization", () => {
  it("rejects an unauthenticated mutation before calling the Gateway", async () => {
    process.env.CONSOLE_OPERATOR_TOKEN_SHA256 = "a".repeat(64);
    process.env.CONSOLE_SESSION_SECRET = "s".repeat(32);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const formData = new FormData();
    formData.set("developerId", "developer_test");
    formData.set("developerName", "Test Developer");
    formData.set("id", "app_test");
    formData.set("name", "Test App");

    await expect(createConsoleApp(formData)).rejects.toThrow(
      "Console operator authentication is required.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
