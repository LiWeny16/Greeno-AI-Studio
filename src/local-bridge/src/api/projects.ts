import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { MusicIrSchema, type MusicIr, type ProjectEvent } from "@cc-music/music-ir";
import { nanoid } from "nanoid";
import type { BridgeConfig } from "../config";
import { createProject, listProjects, loadProject, saveProjectIr } from "../projects/project-store";
import { createSnapshot, listSnapshots } from "../projects/snapshot-store";
import { appendEvent, readEvents } from "../projects/events-store";

const CreateProjectBodySchema = z.object({
  title: z.string().min(1),
  tempo: z.number().int().min(40).max(240).default(120),
  key: z.string().min(1).default("C major"),
  timeSignature: z
    .string()
    .regex(/^\d+\/\d+$/)
    .default("4/4"),
});

type CreateProjectBody = z.infer<typeof CreateProjectBodySchema>;

const ProjectIdParamsSchema = z.object({
  projectId: z.string().min(1),
});

type ProjectIdParams = z.infer<typeof ProjectIdParamsSchema>;

export async function registerProjectRoutes(app: FastifyInstance, config: BridgeConfig) {
  app.post(
    "/api/projects",
    {
      schema: {
        body: CreateProjectBodySchema,
      },
    },
    async (request) => {
      const { title, tempo, key, timeSignature } = request.body as CreateProjectBody;
      const result = await createProject(config, title, tempo, key, timeSignature);

      const event: ProjectEvent = {
        eventId: `evt_${nanoid()}`,
        projectId: result.manifest.projectId,
        actor: { type: "local_user" },
        type: "project_created",
        timestamp: new Date().toISOString(),
        payload: {},
      };
      await appendEvent(config, result.manifest.projectId, event);

      return result;
    },
  );

  app.get("/api/projects", async () => {
    const projects = await listProjects(config);
    return { projects };
  });

  app.get(
    "/api/projects/:projectId",
    {
      schema: {
        params: ProjectIdParamsSchema,
      },
    },
    async (request) => {
      const { projectId } = request.params as ProjectIdParams;
      const { manifest, ir } = await loadProject(config, projectId);
      return { manifest, ir };
    },
  );

  app.put(
    "/api/projects/:projectId/ir",
    {
      schema: {
        params: ProjectIdParamsSchema,
        body: MusicIrSchema,
      },
    },
    async (request) => {
      const { projectId } = request.params as ProjectIdParams;
      const ir = request.body as MusicIr;
      const saved = await saveProjectIr(config, projectId, ir);

      const event: ProjectEvent = {
        eventId: `evt_${nanoid()}`,
        projectId,
        actor: { type: "local_user" },
        type: "project_saved",
        timestamp: new Date().toISOString(),
        payload: {},
      };
      await appendEvent(config, projectId, event);

      return { ir: saved };
    },
  );

  app.post(
    "/api/projects/:projectId/snapshots",
    {
      schema: {
        params: ProjectIdParamsSchema,
      },
    },
    async (request) => {
      const { projectId } = request.params as ProjectIdParams;
      const { ir } = await loadProject(config, projectId);
      const snapshotId = await createSnapshot(config, projectId, ir);

      const event: ProjectEvent = {
        eventId: `evt_${nanoid()}`,
        projectId,
        actor: { type: "local_user" },
        type: "project_saved",
        timestamp: new Date().toISOString(),
        payload: { snapshotId },
      };
      await appendEvent(config, projectId, event);

      return { snapshotId, ir };
    },
  );

  app.get(
    "/api/projects/:projectId/snapshots",
    {
      schema: {
        params: ProjectIdParamsSchema,
      },
    },
    async (request) => {
      const { projectId } = request.params as ProjectIdParams;
      const snapshots = await listSnapshots(config, projectId);
      return { snapshots };
    },
  );

  app.get(
    "/api/projects/:projectId/events",
    {
      schema: {
        params: ProjectIdParamsSchema,
      },
    },
    async (request) => {
      const { projectId } = request.params as ProjectIdParams;
      const events = await readEvents(config, projectId);
      return { events };
    },
  );
}
