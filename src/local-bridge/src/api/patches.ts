import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { IrPatchProposalSchema, MusicIrSchema, type IrPatchProposal, type ProjectEvent } from "@cc-music/music-ir";
import { nanoid } from "nanoid";
import type { BridgeConfig } from "../config";
import { loadProject, saveProjectIr } from "../projects/project-store";
import { createSnapshot } from "../projects/snapshot-store";
import { appendEvent } from "../projects/events-store";

const ProjectIdParamsSchema = z.object({
  projectId: z.string().min(1),
});

type ProjectIdParams = z.infer<typeof ProjectIdParamsSchema>;

const PatchBodySchema = z.object({
  summary: z.string().min(1),
  patch: IrPatchProposalSchema.shape.patch,
  musicalDiff: IrPatchProposalSchema.shape.musicalDiff.optional(),
});

type PatchBody = z.infer<typeof PatchBodySchema>;

function applyJsonPatch(
  target: Record<string, unknown>,
  patches: { op: string; path: string; value?: unknown }[],
): Record<string, unknown> {
  const result = JSON.parse(JSON.stringify(target)) as Record<string, unknown>;
  for (const { op, path: jsonPath, value } of patches) {
    const segments = jsonPath.split("/").filter(Boolean);
    if (segments.length === 0) continue;

    let current: Record<string, unknown> = result;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i]!;
      if (!(seg in current) || typeof current[seg] !== "object" || current[seg] === null) {
        current[seg] = /^\d+$/.test(segments[i + 1] ?? "") ? [] : {};
      }
      current = current[seg] as Record<string, unknown>;
    }

    const lastSeg = segments[segments.length - 1]!;

    switch (op) {
      case "add":
      case "replace":
        current[lastSeg] = value;
        break;
      case "remove":
        if (Array.isArray(current)) {
          (current as unknown[]).splice(Number(lastSeg), 1);
        } else {
          delete current[lastSeg];
        }
        break;
    }
  }
  return result;
}

export async function registerPatchRoutes(app: FastifyInstance, config: BridgeConfig) {
  app.post(
    "/api/projects/:projectId/patches/preview",
    {
      schema: {
        params: ProjectIdParamsSchema,
        body: PatchBodySchema,
      },
    },
    async (request) => {
      const { projectId } = request.params as ProjectIdParams;
      const { summary, patch, musicalDiff } = request.body as PatchBody;

      const { ir } = await loadProject(config, projectId);

      const previewIrRaw = applyJsonPatch(ir as unknown as Record<string, unknown>, patch);
      let previewIr;
      try {
        previewIr = MusicIrSchema.parse(previewIrRaw);
      } catch (err) {
        if (err instanceof ZodError) {
          throw Object.assign(new Error(`Patch produces invalid IR: ${err.message}`), { statusCode: 400 });
        }
        throw err;
      }

      const proposal: IrPatchProposal = {
        proposalId: `patch_${nanoid()}`,
        projectId,
        summary,
        patch,
        musicalDiff: musicalDiff ?? {
          barsChanged: undefined,
          notesAdded: 0,
          notesRemoved: 0,
          preservedMotifs: [],
        },
      };

      return { proposal, previewIr };
    },
  );

  app.post(
    "/api/projects/:projectId/patches/apply",
    {
      schema: {
        params: ProjectIdParamsSchema,
        body: PatchBodySchema,
      },
    },
    async (request) => {
      const { projectId } = request.params as ProjectIdParams;
      const { summary, patch, musicalDiff } = request.body as PatchBody;

      const { ir } = await loadProject(config, projectId);

      const snapshotId = await createSnapshot(config, projectId, ir);

      const patchedRaw = applyJsonPatch(ir as unknown as Record<string, unknown>, patch);
      let patchedIr;
      try {
        patchedIr = MusicIrSchema.parse(patchedRaw);
      } catch (err) {
        if (err instanceof ZodError) {
          throw Object.assign(new Error(`Patch produces invalid IR: ${err.message}`), { statusCode: 400 });
        }
        throw err;
      }

      const saved = await saveProjectIr(config, projectId, patchedIr);

      const proposal: IrPatchProposal = {
        proposalId: `patch_${nanoid()}`,
        projectId,
        summary,
        patch,
        musicalDiff: musicalDiff ?? {
          barsChanged: undefined,
          notesAdded: 0,
          notesRemoved: 0,
          preservedMotifs: [],
        },
      };

      const event: ProjectEvent = {
        eventId: `evt_${nanoid()}`,
        projectId,
        actor: { type: "local_user" },
        type: "patch_applied",
        timestamp: new Date().toISOString(),
        payload: {
          snapshotId,
          patchId: proposal.proposalId,
        },
      };
      await appendEvent(config, projectId, event);

      return { ir: saved, snapshotId, proposalId: proposal.proposalId };
    },
  );
}
