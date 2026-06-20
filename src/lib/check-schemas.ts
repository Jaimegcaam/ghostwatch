import { z } from "zod";
import { validateMonitorUrl } from "@/lib/url-security";

const httpMethods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

const monitorUrl = z
  .string()
  .trim()
  .min(1, "URL is required")
  .superRefine((value, ctx) => {
    const result = validateMonitorUrl(value);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.error });
    }
  });

const headersSchema = z.record(z.string(), z.string()).nullable().optional();

export const createCheckSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  url: monitorUrl,
  method: z.enum(httpMethods).optional(),
  headers: headersSchema,
  body: z.string().nullable().optional(),
  expectedStatus: z.number().int().min(100).max(599).optional(),
  timeout: z.number().int().min(1000).max(120_000).optional(),
  interval: z.number().int().min(15).max(86_400).optional(),
  projectId: z.string().trim().min(1, "projectId is required"),
  isPublic: z.boolean().optional(),
  regions: z.array(z.string()).optional(),
  folder: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const updateCheckSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    url: monitorUrl.optional(),
    method: z.enum(httpMethods).optional(),
    headers: headersSchema,
    body: z.string().nullable().optional(),
    expectedStatus: z.number().int().min(100).max(599).optional(),
    timeout: z.number().int().min(1000).max(120_000).optional(),
    interval: z.number().int().min(15).max(86_400).optional(),
    enabled: z.boolean().optional(),
    isPublic: z.boolean().optional(),
    regions: z.array(z.string()).optional(),
    folder: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export type CreateCheckInput = z.infer<typeof createCheckSchema>;
export type UpdateCheckInput = z.infer<typeof updateCheckSchema>;
