import { IrPatchProposalSchema, type IrPatchProposal } from "@cc-music/music-ir";
import { z } from "zod";

export const AgentSelectionSchema = z.object({
  barRange: z.tuple([z.number().int().positive(), z.number().int().positive()]).optional(),
  sectionIds: z.array(z.string().min(1)).default([]),
  trackIds: z.array(z.string().min(1)).default([])
});

export const AgentRequestSchema = z.object({
  requestId: z.string().min(1),
  agent: z.enum(["mock", "codex", "claude", "openai_compat"]),
  mode: z.literal("ir_patch"),
  prompt: z.string().min(1),
  projectId: z.string().min(1),
  snapshotId: z.string().min(1),
  selection: AgentSelectionSchema,
  allowedActions: z.array(z.enum(["propose_ir_patch", "explain_change"]))
});

export const AgentStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("started"),
    requestId: z.string().min(1),
    timestamp: z.string().datetime()
  }),
  z.object({
    type: z.literal("message"),
    requestId: z.string().min(1),
    timestamp: z.string().datetime(),
    message: z.string()
  }),
  z.object({
    type: z.literal("proposal"),
    requestId: z.string().min(1),
    timestamp: z.string().datetime(),
    proposal: IrPatchProposalSchema
  }),
  z.object({
    type: z.literal("failed"),
    requestId: z.string().min(1),
    timestamp: z.string().datetime(),
    code: z.enum([
      "invalid_input",
      "invalid_json",
      "schema_invalid",
      "timeout",
      "cancelled",
      "dependency_missing",
      "adapter_failed"
    ]),
    message: z.string()
  }),
  z.object({
    type: z.literal("completed"),
    requestId: z.string().min(1),
    timestamp: z.string().datetime()
  })
]);

export const JobStatusSchema = z.enum(["queued", "running", "succeeded", "failed", "cancelled"]);

export const JobRequestSchema = z.object({
  jobId: z.string().min(1),
  projectId: z.string().min(1),
  type: z.enum(["agent_ir_patch", "midi_import", "midi_export", "mock_render_preview"]),
  payload: z.record(z.unknown()).default({}),
  timeoutMs: z.number().int().positive().max(300000).default(30000)
});

export const JobResultSchema = z.object({
  jobId: z.string().min(1),
  projectId: z.string().min(1),
  status: JobStatusSchema,
  artifactManifest: z
    .array(
      z.object({
        path: z.string().min(1),
        kind: z.enum(["midi", "log", "json", "preview"])
      })
    )
    .default([]),
  error: z
    .object({
      code: z.string().min(1),
      message: z.string().min(1)
    })
    .optional()
});

export type AgentRequest = z.infer<typeof AgentRequestSchema>;
export type AgentStreamEvent = z.infer<typeof AgentStreamEventSchema>;
export type JobRequest = z.infer<typeof JobRequestSchema>;
export type JobResult = z.infer<typeof JobResultSchema>;

export function createProposalEvent(
  requestId: string,
  timestamp: string,
  proposal: IrPatchProposal
): AgentStreamEvent {
  return AgentStreamEventSchema.parse({
    type: "proposal",
    requestId,
    timestamp,
    proposal
  });
}
