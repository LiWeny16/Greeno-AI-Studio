export const projectLayout = {
  manifest: "manifest.json",
  project: "project.json",
  events: "events.ndjson",
  snapshots: "snapshots",
  exports: "exports",
  assets: "assets",
  jobs: "jobs"
} as const;

export function snapshotFileName(index: number): string {
  if (!Number.isInteger(index) || index <= 0) {
    throw new Error("snapshot index must be a positive integer");
  }
  return `snap_${index.toString().padStart(6, "0")}.json`;
}
