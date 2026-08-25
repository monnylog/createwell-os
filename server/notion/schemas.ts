import { z } from "zod";

export const topicWellInputSchema = z.object({
  name: z.string().trim().min(3).max(120),
  drop: z.string().trim().min(20).max(5_000),
  anonymous: z.boolean().default(true),
  consentToShare: z.boolean().default(false),
  source: z.literal("Public Form").default("Public Form"),
  idempotencyKey: z.string().trim().min(16).max(128).optional(),
});

export const checkInInputSchema = z.object({
  mood: z.enum([
    "Grounded",
    "Clear",
    "Tender",
    "Activated",
    "Low",
    "Energized",
    "Mixed",
  ]),
  absorption: z.enum(["Open", "Steady", "Full", "Overfull", "Recovering"]),
  bodyStatus: z.enum([
    "Steady",
    "Activated",
    "Tender",
    "Depleted",
    "Restoring",
  ]),
  reflection: z.string().trim().max(3_000).optional().default(""),
  shareLevel: z.enum(["Private", "Facilitator", "Team"]).default("Private"),
  followUpNeeded: z.boolean().default(false),
});

export const taskCreateInputSchema = z.object({
  name: z.string().trim().min(3).max(160),
  status: z.string().trim().min(2).max(80),
  phase: z.string().trim().min(2).max(80),
  priority: z.string().trim().max(80).optional().default(""),
  nextAction: z.string().trim().max(500).optional().default(""),
  due: z.string().date().optional(),
});

export type TopicWellInput = z.infer<typeof topicWellInputSchema>;
export type CheckInInput = z.infer<typeof checkInInputSchema>;
