import { z } from "zod";

export const ConnectIntegrationSchema = z.object({
  provider: z.enum(["gsc", "psi", "ga4", "clarity", "cloudflare"]),
  apiKey: z.string().min(1).optional(),
  clarityProjectId: z.string().optional(),
});

export const UpdateIntegrationSchema = z.object({
  enabled: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});
