import { z } from "zod";

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  domain: z
    .string()
    .min(1)
    .transform((d) => {
      if (!d.startsWith("http://") && !d.startsWith("https://")) {
        return `https://${d}`;
      }
      return d;
    })
    .pipe(z.string().url()),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  settings: z
    .object({
      maxPages: z.number().int().min(1).optional(),
      maxDepth: z.number().int().min(1).max(10).optional(),
      schedule: z.enum(["manual", "daily", "weekly", "monthly"]).optional(),
    })
    .optional(),
  branding: z
    .object({
      logoUrl: z.string().url().optional().or(z.literal("")),
      companyName: z.string().optional(),
      primaryColor: z
        .string()
        .regex(/^#([0-9a-f]{3}){1,2}$/i)
        .optional(),
    })
    .optional(),
});

export type CreateProject = z.infer<typeof CreateProjectSchema>;
export type UpdateProject = z.infer<typeof UpdateProjectSchema>;
