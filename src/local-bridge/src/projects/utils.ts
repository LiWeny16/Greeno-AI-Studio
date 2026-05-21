import { rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BridgeConfig } from "../config";

export function projectDir(config: BridgeConfig, projectId: string): string {
  return path.join(config.projectRoot, "projects", projectId);
}

export async function atomicWrite(filePath: string, data: string): Promise<void> {
  const tmpPath = filePath + ".tmp";
  await writeFile(tmpPath, data, "utf-8");
  await rename(tmpPath, filePath);
}
