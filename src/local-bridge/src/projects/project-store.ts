import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { MusicIrSchema, ProjectManifestSchema, type MusicIr, type ProjectManifest } from "@cc-music/music-ir";
import { nanoid } from "nanoid";
import type { BridgeConfig } from "../config";
import { projectLayout } from "./project-layout";
import { recoverFromLatestSnapshot } from "./snapshot-store";
import { atomicWrite, projectDir } from "./utils";
import { withWriteLock } from "./write-lock";

const APP_VERSION = "0.0.0";

export async function createProject(
  config: BridgeConfig,
  title: string,
  tempo: number,
  key: string,
  timeSignature: string,
): Promise<{ manifest: ProjectManifest; ir: MusicIr }> {
  const projectId = nanoid();
  const now = new Date().toISOString();

  const manifest: ProjectManifest = {
    projectId,
    title,
    schemaVersion: 1,
    appVersion: APP_VERSION,
    createdAt: now,
    updatedAt: now,
  };

  const ir: MusicIr = {
    schemaVersion: 1,
    projectId,
    title,
    tempo,
    key,
    timeSignature,
    sections: [],
    motifs: [],
    tracks: [],
  };

  ProjectManifestSchema.parse(manifest);
  MusicIrSchema.parse(ir);

  const dir = projectDir(config, projectId);
  await mkdir(path.join(dir, projectLayout.snapshots), { recursive: true });
  await mkdir(path.join(dir, projectLayout.exports), { recursive: true });
  await mkdir(path.join(dir, projectLayout.assets), { recursive: true });
  await mkdir(path.join(dir, projectLayout.jobs), { recursive: true });

  await atomicWrite(path.join(dir, projectLayout.manifest), JSON.stringify(manifest, null, 2));
  await atomicWrite(path.join(dir, projectLayout.project), JSON.stringify(ir, null, 2));

  return { manifest, ir };
}

export async function loadProject(
  config: BridgeConfig,
  projectId: string,
): Promise<{ manifest: ProjectManifest; ir: MusicIr }> {
  const dir = projectDir(config, projectId);

  let manifestRaw: string;
  try {
    manifestRaw = await readFile(path.join(dir, projectLayout.manifest), "utf-8");
  } catch {
    throw Object.assign(new Error(`Project not found: ${projectId}`), { statusCode: 404 });
  }

  const manifest = ProjectManifestSchema.parse(JSON.parse(manifestRaw));

  let irRaw: string;
  try {
    irRaw = await readFile(path.join(dir, projectLayout.project), "utf-8");
  } catch {
    const recovered = await recoverFromLatestSnapshot(config, projectId);
    if (recovered) {
      await atomicWrite(path.join(dir, projectLayout.project), JSON.stringify(recovered, null, 2));
      return { manifest, ir: recovered };
    }
    throw Object.assign(new Error(`Project IR not found and no valid snapshot available: ${projectId}`), {
      statusCode: 500,
    });
  }

  const ir = MusicIrSchema.parse(JSON.parse(irRaw));
  return { manifest, ir };
}

export async function saveProjectIr(
  config: BridgeConfig,
  projectId: string,
  ir: MusicIr,
): Promise<MusicIr> {
  return withWriteLock(projectId, async () => {
    const dir = projectDir(config, projectId);

    MusicIrSchema.parse(ir);

    if (ir.projectId !== projectId) {
      throw Object.assign(new Error("IR projectId does not match URL projectId"), { statusCode: 400 });
    }

    await atomicWrite(path.join(dir, projectLayout.project), JSON.stringify(ir, null, 2));

    const manifestRaw = await readFile(path.join(dir, projectLayout.manifest), "utf-8");
    const manifest = ProjectManifestSchema.parse(JSON.parse(manifestRaw));
    manifest.updatedAt = new Date().toISOString();
    await atomicWrite(path.join(dir, projectLayout.manifest), JSON.stringify(manifest, null, 2));

    return ir;
  });
}

export async function listProjects(config: BridgeConfig): Promise<ProjectManifest[]> {
  const projectsBase = path.join(config.projectRoot, "projects");

  let entries: string[];
  try {
    entries = await readdir(projectsBase);
  } catch {
    return [];
  }

  const manifests: ProjectManifest[] = [];
  for (const entry of entries) {
    try {
      const manifestPath = path.join(projectsBase, entry, projectLayout.manifest);
      const st = await stat(manifestPath);
      if (!st.isFile()) continue;

      const raw = await readFile(manifestPath, "utf-8");
      const manifest = ProjectManifestSchema.parse(JSON.parse(raw));
      manifests.push(manifest);
    } catch {
      // skip invalid or missing manifests
    }
  }

  manifests.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return manifests;
}
