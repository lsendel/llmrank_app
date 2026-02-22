import { PLAN_LIMITS, type PlanTier, type TokenScope } from "@llm-boost/shared";
import type { ProjectRepository } from "../repositories";
import { ServiceError } from "./errors";
import { assertProjectOwnership } from "./shared/assert-ownership";

export type { TokenScope };

// ---------------------------------------------------------------------------
// Domain Types
// ---------------------------------------------------------------------------

export interface ApiToken {
  id: string;
  userId: string;
  projectId: string;
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  scopes: TokenScope[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface TokenContext {
  tokenId: string;
  userId: string;
  projectId: string;
  scopes: TokenScope[];
}

export interface CreateTokenInput {
  userId: string;
  userPlan: PlanTier;
  projectId: string;
  name: string;
  scopes: TokenScope[];
  expiresAt?: Date;
}

// ---------------------------------------------------------------------------
// Repository Interface
// ---------------------------------------------------------------------------

export interface ApiTokenRepository {
  create(
    data: Omit<ApiToken, "id" | "lastUsedAt" | "revokedAt" | "createdAt">,
  ): Promise<ApiToken>;
  findByHash(tokenHash: string): Promise<ApiToken | null>;
  listByUser(userId: string): Promise<Omit<ApiToken, "tokenHash">[]>;
  revoke(id: string): Promise<ApiToken | null>;
  updateLastUsed(id: string): Promise<void>;
  countByUser(userId: string): Promise<number>;
}

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export interface ApiTokenServiceDeps {
  apiTokens: ApiTokenRepository;
  projects: Pick<ProjectRepository, "getById">;
}

// ---------------------------------------------------------------------------
// Crypto Helpers (Workers-compatible)
// ---------------------------------------------------------------------------

const BASE62_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function toBase62(bytes: Uint8Array): string {
  let result = "";
  for (const byte of bytes) {
    // Two base62 digits per byte (62^2 = 3844 > 256)
    result += BASE62_CHARS[byte % 62];
    result += BASE62_CHARS[Math.floor(byte / 62) % 62];
  }
  return result;
}

function generateRawToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `llmb_${toBase62(bytes)}`;
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// Service Factory
// ---------------------------------------------------------------------------

export function createApiTokenService(deps: ApiTokenServiceDeps) {
  return {
    /**
     * Generate a new API token.
     * Returns the plaintext token exactly once; only the hash is stored.
     */
    async create(
      input: CreateTokenInput,
    ): Promise<{ plainToken: string; token: ApiToken }> {
      // 1. Verify project ownership
      await assertProjectOwnership(
        deps.projects,
        input.userId,
        input.projectId,
      );

      // 2. Enforce plan limits
      const limits = PLAN_LIMITS[input.userPlan];
      if (limits.apiTokens === 0) {
        throw new ServiceError(
          "PLAN_LIMIT_REACHED",
          403,
          "Your plan does not include API token access",
        );
      }

      const existingCount = await deps.apiTokens.countByUser(input.userId);
      if (existingCount >= limits.apiTokens) {
        throw new ServiceError(
          "PLAN_LIMIT_REACHED",
          403,
          `API token limit reached (${limits.apiTokens} tokens for ${input.userPlan} plan)`,
        );
      }

      // 3. Generate token + hash
      const plainToken = generateRawToken();
      const tokenHash = await sha256Hex(plainToken);
      const tokenPrefix = plainToken.slice(0, 9); // "llmb_" + 4 chars

      // 4. Store
      const token = await deps.apiTokens.create({
        userId: input.userId,
        projectId: input.projectId,
        name: input.name,
        tokenHash,
        tokenPrefix,
        scopes: input.scopes,
        expiresAt: input.expiresAt ?? null,
      });

      return { plainToken, token };
    },

    /**
     * Authenticate a raw API token.
     * Hashes the raw token, looks it up, updates lastUsedAt, returns context.
     */
    async authenticate(rawToken: string): Promise<TokenContext | null> {
      const tokenHash = await sha256Hex(rawToken);
      const token = await deps.apiTokens.findByHash(tokenHash);

      if (!token) {
        return null;
      }

      // Fire-and-forget lastUsedAt update (non-blocking)
      deps.apiTokens.updateLastUsed(token.id).catch(() => {
        // Swallow errors — lastUsedAt is non-critical
      });

      return {
        tokenId: token.id,
        userId: token.userId,
        projectId: token.projectId,
        scopes: token.scopes as TokenScope[],
      };
    },

    /**
     * List all tokens for a user (without tokenHash field).
     */
    async list(userId: string): Promise<Omit<ApiToken, "tokenHash">[]> {
      return deps.apiTokens.listByUser(userId);
    },

    /**
     * Revoke a token after verifying ownership.
     */
    async revoke(userId: string, tokenId: string): Promise<ApiToken | null> {
      // Verify ownership: check the token belongs to this user
      const userTokens = await deps.apiTokens.listByUser(userId);
      const owned = userTokens.some((t) => t.id === tokenId);

      if (!owned) {
        throw new ServiceError("NOT_FOUND", 404, "Token not found");
      }

      return deps.apiTokens.revoke(tokenId);
    },
  };
}
