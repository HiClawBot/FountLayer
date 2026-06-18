import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const algorithm = "aes-256-gcm";
const encodedPrefix = "fl_cred_v1";
const ivByteLength = 12;
const keyByteLength = 32;

export type EncryptedCredential = {
  ciphertext: string;
  keyVersion: string;
};

export type CredentialCipher = {
  decrypt(input: EncryptedCredential, aad?: string): string;
  encrypt(plaintext: string, aad?: string): EncryptedCredential;
};

function base64UrlEncode(value: Buffer): string {
  return value.toString("base64url");
}

function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

type AadCipher = {
  setAAD(value: Buffer): void;
};

function normalizeMasterKey(masterKey: string | Buffer): Buffer {
  const key = Buffer.isBuffer(masterKey)
    ? masterKey
    : masterKey.startsWith("base64:")
      ? Buffer.from(masterKey.slice("base64:".length), "base64")
      : masterKey.startsWith("hex:")
        ? Buffer.from(masterKey.slice("hex:".length), "hex")
        : Buffer.from(masterKey, "utf8");

  if (key.byteLength !== keyByteLength) {
    throw new Error(
      "Credential master key must be exactly 32 bytes. Use base64:<key> or hex:<key> for binary keys.",
    );
  }

  return key;
}

function setAad(cipher: unknown, aad?: string) {
  if (aad) {
    (cipher as AadCipher).setAAD(Buffer.from(aad, "utf8"));
  }
}

export function createCredentialCipher(input: {
  keyVersion?: string;
  masterKey: string | Buffer;
}): CredentialCipher {
  const key = normalizeMasterKey(input.masterKey);
  const keyVersion = input.keyVersion ?? "local-v1";

  return {
    encrypt(plaintext, aad) {
      const iv = randomBytes(ivByteLength);
      const cipher = createCipheriv(algorithm, key, iv);
      setAad(cipher, aad);
      const encrypted = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
      ]);
      const tag = cipher.getAuthTag();

      return {
        ciphertext: [
          encodedPrefix,
          base64UrlEncode(iv),
          base64UrlEncode(tag),
          base64UrlEncode(encrypted),
        ].join("."),
        keyVersion,
      };
    },

    decrypt(input, aad) {
      const [prefix, encodedIv, encodedTag, encodedCiphertext] =
        input.ciphertext.split(".");

      if (
        prefix !== encodedPrefix ||
        !encodedIv ||
        !encodedTag ||
        !encodedCiphertext
      ) {
        throw new Error("Unsupported encrypted credential format.");
      }

      const decipher = createDecipheriv(
        algorithm,
        key,
        base64UrlDecode(encodedIv),
      );
      setAad(decipher, aad);
      decipher.setAuthTag(base64UrlDecode(encodedTag));

      return Buffer.concat([
        decipher.update(base64UrlDecode(encodedCiphertext)),
        decipher.final(),
      ]).toString("utf8");
    },
  };
}

export function maskCredential(value: string): string {
  if (value.length <= 8) {
    return "********";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
