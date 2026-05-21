import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { BridgeConfig } from "../config";
import { getJob } from "../jobs/job-store";

const JobParamsSchema = z.object({
  projectId: z.string().min(1),
  jobId: z.string().min(1),
});

type JobParams = z.infer<typeof JobParamsSchema>;

export async function registerJobRoutes(app: FastifyInstance, _config: BridgeConfig) {
  app.get(
    "/api/projects/:projectId/jobs/:jobId",
    {
      schema: {
        params: JobParamsSchema,
      },
    },
    async (request) => {
      const { jobId } = request.params as JobParams;
      const job = getJob(jobId);

      if (!job) {
        throw Object.assign(new Error(`Job not found: ${jobId}`), { statusCode: 404 });
      }

      return job;
    },
  );
}
