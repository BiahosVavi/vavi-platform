import { z } from "zod";

// Structured-output contract for Telegram quick-add parsing.
// Project slugs are a closed set (matches supabase/migrations/0005_seed.sql).

export const quickAddProjectSchema = z.enum(["flyson", "abna-son", "personal-brand"]);
export type QuickAddProject = z.infer<typeof quickAddProjectSchema>;

const createTaskSchema = z.object({
  type: z.literal("create_task"),
  project: quickAddProjectSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(["p1", "p2", "p3", "p4"]).optional(),
  /** ISO date YYYY-MM-DD */
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tags: z.array(z.string()).optional(),
});

const logPipelineSchema = z.object({
  type: z.literal("log_pipeline"),
  project: quickAddProjectSchema,
  event: z.enum(["lead_added", "proposal_sent", "deal_won", "deal_lost"]),
  contact: z.string().optional(),
  value_mad: z.number().optional(),
  note: z.string().optional(),
});

const logMoneySchema = z.object({
  type: z.literal("log_money"),
  project: quickAddProjectSchema,
  kind: z.enum(["revenue", "expense"]),
  amount_mad: z.number(),
  category: z.string().optional(),
  note: z.string().optional(),
});

const logMetricSchema = z.object({
  type: z.literal("log_metric"),
  project: quickAddProjectSchema,
  metric_key: z.string().min(1),
  value: z.number(),
  note: z.string().optional(),
});

const captureIdeaSchema = z.object({
  type: z.literal("capture_idea"),
  project: quickAddProjectSchema,
  title: z.string().min(1),
  description: z.string().optional(),
});

const unknownSchema = z.object({
  type: z.literal("unknown"),
  reason: z.string(),
});

export const quickAddActionSchema = z.discriminatedUnion("type", [
  createTaskSchema,
  logPipelineSchema,
  logMoneySchema,
  logMetricSchema,
  captureIdeaSchema,
  unknownSchema,
]);

export const quickAddSchema = z.object({
  confidence: z.enum(["high", "low"]),
  action: quickAddActionSchema,
});

export type QuickAddAction = z.infer<typeof quickAddActionSchema>;
export type QuickAddResult = z.infer<typeof quickAddSchema>;
