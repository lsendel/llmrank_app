import { z } from "zod";

export const CollectEventSchema = z.object({
  pid: z.string().uuid(),
  url: z.string().url(),
  ref: z.string().optional().default(""),
  ua: z.string().optional().default(""),
});

export type CollectEvent = z.infer<typeof CollectEventSchema>;
