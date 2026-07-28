import { z } from "zod";

export const environmentSyncActionSchema = z.enum([
  "push_missing",
  "pull_missing",
  "resolve_local",
  "resolve_remote",
]);

export const environmentSyncRequestSchema = z.object({
  action: environmentSyncActionSchema,
  planHash: z.string().regex(/^[a-f0-9]{64}$/),
  confirmed: z.literal(true),
});

export type EnvironmentSyncAction = z.infer<typeof environmentSyncActionSchema>;
