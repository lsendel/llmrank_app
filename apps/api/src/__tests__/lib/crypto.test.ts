import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "../../lib/crypto";

// 32-byte hex key (AES-256)
const VALID_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("crypto", () => {
  it("encrypts and decrypts a string round-trip", async () => {
    const plaintext = "Hello, World! This is secret data.";
    const encrypted = await encrypt(plaintext, VALID_KEY);

    // Ciphertext should contain IV and ciphertext separated by colon
    expect(encrypted).toContain(":");
    expect(encrypted).not.toBe(plaintext);

    const decrypted = await decrypt(encrypted, VALID_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertexts for same plaintext (random IV)", async () => {
    const plaintext = "Same text, different encryption";
    const encrypted1 = await encrypt(plaintext, VALID_KEY);
    const encrypted2 = await encrypt(plaintext, VALID_KEY);

    // Random IV means each encryption produces different output
    expect(encrypted1).not.toBe(encrypted2);

    // Both should decrypt to the same value
    expect(await decrypt(encrypted1, VALID_KEY)).toBe(plaintext);
    expect(await decrypt(encrypted2, VALID_KEY)).toBe(plaintext);
  });

  it("fails to decrypt with wrong key", async () => {
    const plaintext = "Secret message";
    const encrypted = await encrypt(plaintext, VALID_KEY);

    const wrongKey =
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

    await expect(decrypt(encrypted, wrongKey)).rejects.toThrow();
  });

  it("handles empty string plaintext", async () => {
    const plaintext = "";
    const encrypted = await encrypt(plaintext, VALID_KEY);
    const decrypted = await decrypt(encrypted, VALID_KEY);
    expect(decrypted).toBe("");
  });
});
