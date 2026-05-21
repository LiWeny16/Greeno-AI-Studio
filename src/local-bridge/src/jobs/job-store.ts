import { JobResultSchema, type JobResult } from "@cc-music/agent-protocol";

const jobs = new Map<string, JobResult>();

export function setJob(jobId: string, result: JobResult): void {
  JobResultSchema.parse(result);
  jobs.set(jobId, result);
}

export function getJob(jobId: string): JobResult | undefined {
  return jobs.get(jobId);
}
