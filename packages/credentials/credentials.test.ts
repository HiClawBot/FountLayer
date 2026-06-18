import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createCredentialCipher, maskCredential } from "./src/index";

const masterKey = randomBytes(32);

describe("credential encryption", () => {
  it("round-trips a provider credential with authenticated context", () => {
    const cipher = createCredentialCipher({
      keyVersion: "test-v1",
      masterKey,
    });
    const encrypted = cipher.encrypt("provider-secret-placeholder", "cred_1");

    expect(encrypted.keyVersion).toBe("test-v1");
    expect(encrypted.ciphertext).toMatch(/^fl_cred_v1\./);
    expect(encrypted.ciphertext).not.toContain("provider-secret-placeholder");
    expect(cipher.decrypt(encrypted, "cred_1")).toBe(
      "provider-secret-placeholder",
    );
  });

  it("rejects decryption with the wrong authenticated context", () => {
    const cipher = createCredentialCipher({ masterKey });
    const encrypted = cipher.encrypt("provider-secret-placeholder", "cred_1");

    expect(() => cipher.decrypt(encrypted, "cred_2")).toThrow();
  });

  it("rejects invalid master key lengths", () => {
    expect(() =>
      createCredentialCipher({
        masterKey: "too-short",
      }),
    ).toThrow("exactly 32 bytes");
  });

  it("masks credentials for display", () => {
    expect(maskCredential("abcd1234wxyz")).toBe("abcd...wxyz");
    expect(maskCredential("short")).toBe("********");
  });
});
