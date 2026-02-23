import { describe, it, expect } from "vitest";
import { generateToken, verifyPkceChallenge } from "../crypto";

describe("OAuth Crypto", () => {
  describe("generateToken", () => {
    it("returns hex string of correct length", () => {
      const token = generateToken(16);
      expect(token).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(token).toMatch(/^[0-9a-f]+$/);
    });

    it("generates unique tokens", () => {
      const a = generateToken(32);
      const b = generateToken(32);
      expect(a).not.toBe(b);
    });
  });

  describe("verifyPkceChallenge", () => {
    it("returns true for valid S256 pair", async () => {
      const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
      // Compute expected challenge from verifier
      const encoder = new TextEncoder();
      const digest = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(verifier),
      );
      const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

      const result = await verifyPkceChallenge(verifier, challenge);
      expect(result).toBe(true);
    });

    it("returns false for tampered challenge", async () => {
      const result = await verifyPkceChallenge(
        "valid-verifier",
        "tampered-challenge",
      );
      expect(result).toBe(false);
    });
  });
});
