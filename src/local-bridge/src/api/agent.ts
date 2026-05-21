import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { IrPatchProposalSchema, type IrPatchProposal, type ProjectEvent } from "@cc-music/music-ir";
import { nanoid } from "nanoid";
import type { BridgeConfig } from "../config";
import { loadProject } from "../projects/project-store";
import { appendEvent } from "../projects/events-store";
import { spawnPythonEngine, type PythonWorker } from "../worker-manager";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ProjectIdParamsSchema = z.object({
  projectId: z.string().min(1),
});

const AgentMessageBodySchema = z.object({
  prompt: z.string().min(1),
  selection: z
    .object({
      barRange: z.tuple([z.number().int().positive(), z.number().int().positive()]).optional(),
      sectionIds: z.array(z.string()).optional(),
      trackIds: z.array(z.string()).optional(),
    })
    .optional()
    .default({}),
  snapshotId: z.string().optional(),
});

type ProjectIdParams = z.infer<typeof ProjectIdParamsSchema>;
type AgentMessageBody = z.infer<typeof AgentMessageBodySchema>;

// ---------------------------------------------------------------------------
// Mock proposal (used when Python worker is not enabled)
// ---------------------------------------------------------------------------

function buildMockProposal(projectId: string, summary: string): IrPatchProposal {
  return {
    proposalId: `patch_${nanoid()}`,
    projectId,
    summary,
    patch: [
      {
        op: "replace",
        path: "/sections/1/style/genre",
        value: "dark minimal electronic",
      },
    ],
    musicalDiff: {
      barsChanged: [1, 8],
      notesAdded: 4,
      notesRemoved: 2,
      preservedMotifs: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

export async function registerAgentRoutes(app: FastifyInstance, config: BridgeConfig) {
  // POST /api/projects/:projectId/agent/messages
  // Body: { prompt, selection?, snapshotId? }
  // Returns: IrPatchProposal with streamed events via SSE when Python enabled
  app.post(
    "/api/projects/:projectId/agent/messages",
    {
      schema: {
        params: ProjectIdParamsSchema,
        body: AgentMessageBodySchema,
      },
    },
    async (request, reply) => {
      const { projectId } = request.params as ProjectIdParams;
      const { prompt, selection } = request.body as AgentMessageBody;

      // Verify project exists
      const { ir } = await loadProject(config, projectId);

      const summary = prompt.slice(0, 200);

      // --- Mock mode: return a canned proposal directly ---
      if (!config.pythonWorker.enabled) {
        const proposal = buildMockProposal(projectId, summary);

        const event: ProjectEvent = {
          eventId: `evt_${nanoid()}`,
          projectId,
          actor: { type: "agent" },
          type: "patch_proposed",
          timestamp: new Date().toISOString(),
          payload: { proposalId: proposal.proposalId },
        };
        await appendEvent(config, projectId, event);

        return { proposal };
      }

      // --- Python mode: spawn worker, send agent.run, stream events ---
      let worker: PythonWorker | null = null;
      try {
        worker = spawnPythonEngine(config);

        // Collect stream events to forward in response
        const streamEvents: Array<{ type: string; data: Record<string, unknown> }> = [];
        worker.onEvent((event) => {
          streamEvents.push({
            type: event.type,
            data: event.data,
          });
        });

        const result = (await worker.request("agent.run", {
          prompt,
          snapshot: ir as unknown as Record<string, unknown>,
          selection,
          maxIterations: 10,
        })) as { success: boolean; proposal: Record<string, unknown> | null; error: string | null };

        if (!result.success || !result.proposal) {
          const errorMsg = result.error ?? "Agent did not produce a proposal";
          return reply.status(422).send({ error: errorMsg, streamEvents });
        }

        // Validate proposal shape
        const proposal = IrPatchProposalSchema.parse({
          ...result.proposal,
          proposalId: `patch_${nanoid()}`,
          projectId,
          summary,
        });

        const event: ProjectEvent = {
          eventId: `evt_${nanoid()}`,
          projectId,
          actor: { type: "agent" },
          type: "patch_proposed",
          timestamp: new Date().toISOString(),
          payload: { proposalId: proposal.proposalId },
        };
        await appendEvent(config, projectId, event);

        return { proposal, streamEvents };
      } finally {
        worker?.kill();
      }
    },
  );
}
