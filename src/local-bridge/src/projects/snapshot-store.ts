import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { MusicIrSchema, type MusicIr } from "@cc-music/music-ir";
import type { BridgeConfig } from "../config";
import { projectLayout, snapshotFileName } from "./project-layout";
import { atomicWrite, projectDir } from "./utils";
import { withWriteLock } from "./write-lock";

export async function createSnapshot(
  config: BridgeConfig,
  projectId: string,
  ir: MusicIr,
): Promise<string> {
  return withWriteLock(projectId, async () => {
    MusicIrSchema.parse(ir);

    const dir = path.join(projectDir(config, projectId), projectLayout.snapshots);
    await mkdir(dir, { recursive: true });

    const existing = await listSnapshotFiles(config, projectId);
    let maxIndex = 0;
    for (const name of existing) {
      const match = name.match(/^snap_(\d{6})\.json$/);
      if (match) {
        const idx = parseInt(match[1]!, 10);
        if (idx > maxIndex) maxIndex = idx;
      }
    }
    const nextIndex = maxIndex + 1;
    const fileName = snapshotFileName(nextIndex);

    const filePath = path.join(dir, fileName);
    await atomicWrite(filePath, JSON.stringify(ir, null, 2));

    return fileName;
  });
}

export async function listSnapshots(
  config: BridgeConfig,
  projectId: string,
): Promise<string[]> {
  return listSnapshotFiles(config, projectId);
}

export async function recoverFromLatestSnapshot(
  config: BridgeConfig,
  projectId: string,
): Promise<MusicIr | null> {
  const snapshots = await listSnapshotFiles(config, projectId);
  if (snapshots.length === 0) return null;

  const sorted = [...snapshots].sort().reverse();

  for (const snapFile of sorted) {
    try {
      const dir = projectDir(config, projectId);
      const raw = await readFile(path.join(dir, projectLayout.snapshots, snapFile), "utf-8");
      const ir = MusicIrSchema.parse(JSON.parse(raw));
      return ir;
    } catch {
      continue;
    }
  }

  return null;
}

async function listSnapshotFiles(config: BridgeConfig, projectId: string): Promise<string[]> {
  const dir = path.join(projectDir(config, projectId), projectLayout.snapshots);
  try {
    const entries = await readdir(dir);
    return entries.filter((f) => /^snap_\d{6}\.json$/.test(f)).sort();
  } catch {
    return [];
  }
}
